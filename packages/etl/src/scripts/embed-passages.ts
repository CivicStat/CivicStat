/**
 * Generate vector embeddings for ProgramPassages and Motions.
 *
 * Uses OpenRouter's OpenAI-compatible embedding endpoint (text-embedding-3-small, 1536 dims).
 * Embeddings enable fast cosine-similarity pre-filtering in the semantic matching pipeline,
 * replacing or supplementing keyword-based candidate selection.
 *
 * Usage:
 *   pnpm dev -- embed-passages                          # Embed all un-embedded passages + motions
 *   pnpm dev -- embed-passages --target passages        # Only passages
 *   pnpm dev -- embed-passages --target motions         # Only motions
 *   pnpm dev -- embed-passages --party VVD              # Only passages for VVD programs
 *   pnpm dev -- embed-passages --limit 500              # Process first N items
 *   pnpm dev -- embed-passages --force                  # Re-embed items that already have embeddings
 *
 * Environment:
 *   OPENROUTER_API_KEY — Required for embedding API access
 *   EMBEDDING_MODEL    — Override model (default: openai/text-embedding-3-small)
 *   DATABASE_URL       — Postgres connection string
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Configuration ──────────────────────────────────────────────

const DEFAULT_MODEL = 'openai/text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const BATCH_SIZE = 100; // OpenAI embedding API supports up to 2048 inputs per call
const RATE_LIMIT_MS = 200; // delay between batches

// ─── Embedding API ──────────────────────────────────────────────

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

async function getEmbeddings(texts: string[], model: string, apiKey: string, baseUrl: string): Promise<number[][]> {
  // Truncate texts to ~8000 chars each (model context limit)
  const truncated = texts.map((t) => t.slice(0, 8000));

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://civicstat.nl',
      'X-Title': 'CivicStat ETL',
    },
    body: JSON.stringify({
      model,
      input: truncated,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as EmbeddingResponse;

  // Sort by index to match input order
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

// ─── Helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Embed Passages ─────────────────────────────────────────────

async function embedPassages(opts: {
  model: string;
  apiKey: string;
  baseUrl: string;
  party?: string;
  limit?: number;
  force?: boolean;
}): Promise<number> {
  const { model, apiKey, baseUrl, party, limit, force } = opts;

  // Build where clause
  const where: any = {};
  if (!force) {
    // Only passages without embeddings (raw SQL needed since Prisma can't filter Unsupported)
  }
  if (party) {
    where.program = { party: { abbreviation: party } };
  }

  // Fetch passages — use raw SQL to check for NULL embedding
  const passageRows = await prisma.$queryRaw<Array<{ id: string; passage_text: string }>>`
    SELECT pp.id, pp.passage_text
    FROM program_passages pp
    ${party ? prisma.$queryRaw`
      JOIN programs p ON pp.program_id = p.id
      JOIN parties pa ON p.party_id = pa.id
      WHERE pa.abbreviation = ${party}
    ` : force ? prisma.$queryRaw`` : prisma.$queryRaw`WHERE pp.embedding IS NULL`}
    ${limit ? prisma.$queryRaw`LIMIT ${limit}` : prisma.$queryRaw``}
  `.catch(() => []);

  // Fallback: use simpler query approach
  let passages: Array<{ id: string; text: string }>;
  if (passageRows.length > 0) {
    passages = passageRows.map((r) => ({ id: r.id, text: r.passage_text }));
  } else {
    // Use a direct query for flexibility
    const whereClause = [
      !force ? 'pp.embedding IS NULL' : null,
      party ? `pa.abbreviation = '${party.replace(/'/g, "''")}'` : null,
    ]
      .filter(Boolean)
      .join(' AND ');

    const sql = `
      SELECT pp.id, pp.passage_text as text
      FROM program_passages pp
      ${party ? 'JOIN programs p ON pp.program_id = p.id JOIN parties pa ON p.party_id = pa.id' : ''}
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY pp.created_at ASC
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; text: string }>>(sql);
    passages = rows;
  }

  console.log(`  Found ${passages.length} passages to embed`);

  let processed = 0;
  let totalTokens = 0;

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => p.text);

    try {
      const embeddings = await getEmbeddings(texts, model, apiKey, baseUrl);

      // Update each passage with its embedding using raw SQL
      for (let j = 0; j < batch.length; j++) {
        const vec = formatVector(embeddings[j]);
        await prisma.$executeRawUnsafe(
          `UPDATE program_passages SET embedding = $1::vector WHERE id = $2::uuid`,
          vec,
          batch[j].id,
        );
      }

      processed += batch.length;

      if (processed % 200 === 0 || processed === passages.length) {
        console.log(`  [${timestamp()}] Passages: ${processed}/${passages.length} embedded`);
      }
    } catch (err) {
      console.error(`  [ERROR] Batch ${i}-${i + batch.length}: ${(err as Error).message}`);
    }

    if (i + BATCH_SIZE < passages.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  return processed;
}

// ─── Embed Motions ──────────────────────────────────────────────

async function embedMotions(opts: {
  model: string;
  apiKey: string;
  baseUrl: string;
  limit?: number;
  force?: boolean;
}): Promise<number> {
  const { model, apiKey, baseUrl, limit, force } = opts;

  const whereClause = !force ? 'WHERE m.embedding IS NULL' : '';
  const limitClause = limit ? `LIMIT ${limit}` : '';

  const motions = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; text: string }>>(
    `SELECT m.id, m.title, m.text FROM motions m ${whereClause} ORDER BY m.date_introduced DESC ${limitClause}`,
  );

  console.log(`  Found ${motions.length} motions to embed`);

  let processed = 0;

  for (let i = 0; i < motions.length; i += BATCH_SIZE) {
    const batch = motions.slice(i, i + BATCH_SIZE);
    // Combine title + text for richer embedding
    const texts = batch.map((m) => `${m.title}\n\n${m.text || ''}`.trim());

    try {
      const embeddings = await getEmbeddings(texts, model, apiKey, baseUrl);

      for (let j = 0; j < batch.length; j++) {
        const vec = formatVector(embeddings[j]);
        await prisma.$executeRawUnsafe(
          `UPDATE motions SET embedding = $1::vector WHERE id = $2::uuid`,
          vec,
          batch[j].id,
        );
      }

      processed += batch.length;

      if (processed % 500 === 0 || processed === motions.length) {
        console.log(`  [${timestamp()}] Motions: ${processed}/${motions.length} embedded`);
      }
    } catch (err) {
      console.error(`  [ERROR] Batch ${i}-${i + batch.length}: ${(err as Error).message}`);
    }

    if (i + BATCH_SIZE < motions.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  return processed;
}

// ─── Main ───────────────────────────────────────────────────────

export interface EmbedOptions {
  target?: 'passages' | 'motions' | 'all';
  party?: string;
  limit?: number;
  force?: boolean;
}

export async function runEmbedPassages(options: EmbedOptions = {}): Promise<void> {
  const { target = 'all', party, limit, force = false } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for embedding generation.');
  }

  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
  const baseUrl = 'https://openrouter.ai/api/v1';

  console.log(`\n=== Embedding Generation ===`);
  console.log(`  Model:  ${model}`);
  console.log(`  Dims:   ${EMBEDDING_DIMS}`);
  console.log(`  Target: ${target}`);
  console.log(`  Party:  ${party || 'all'}`);
  console.log(`  Limit:  ${limit || 'all'}`);
  console.log(`  Force:  ${force}`);
  console.log(`============================\n`);

  let passageCount = 0;
  let motionCount = 0;

  if (target === 'passages' || target === 'all') {
    console.log(`[Passages]`);
    passageCount = await embedPassages({ model, apiKey, baseUrl, party, limit, force });
  }

  if (target === 'motions' || target === 'all') {
    console.log(`\n[Motions]`);
    motionCount = await embedMotions({ model, apiKey, baseUrl, limit, force });
  }

  console.log(`\n=== Embedding Complete ===`);
  console.log(`  Passages embedded: ${passageCount}`);
  console.log(`  Motions embedded:  ${motionCount}`);
  console.log(`==========================\n`);

  await prisma.$disconnect();
}
