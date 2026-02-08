/**
 * Seed PVV TK2023 promises extracted from program passages.
 * The PVV program is relatively short and direct; these represent
 * their most distinctive, testable positions.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PromiseSeed {
  promiseCode: string;
  text: string;
  summary: string;
  theme: string;
  specificity: string;
  passageId: string;
  expectedVoteDirection: string;
  pageRef: string | null;
}

const PVV_PROMISES: PromiseSeed[] = [
  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-001',
    text: 'Asielstop en algeheel restrictief immigratiebeleid.',
    summary: 'Volledige asielstop invoeren en algeheel restrictief immigratiebeleid voeren.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'd6557e86-bff0-4420-96e1-b813e679cf2c',
    expectedVoteDirection: 'VOOR',
    pageRef: '8',
  },
  {
    promiseCode: 'PVV-2023-002',
    text: 'Opt out EU-regelgeving asiel en migratie, opzeggen VN-Vluchtelingenverdrag.',
    summary: 'Opt-out uit EU-asielregelgeving en opzegging VN-Vluchtelingenverdrag.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'd6557e86-bff0-4420-96e1-b813e679cf2c',
    expectedVoteDirection: 'VOOR',
    pageRef: '8',
  },
  {
    promiseCode: 'PVV-2023-003',
    text: 'De Nederlandse grensbewaking wordt in ere hersteld, pushbacks van asielzoekers die uit onze veilige buurlanden Nederland in willen komen.',
    summary: 'Grensbewaking herstellen met pushbacks van asielzoekers uit veilige buurlanden.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'd6557e86-bff0-4420-96e1-b813e679cf2c',
    expectedVoteDirection: 'VOOR',
    pageRef: '8',
  },
  {
    promiseCode: 'PVV-2023-004',
    text: 'Strafbaar stellen illegaliteit: illegalen vastzetten en uitzetten.',
    summary: 'Illegaliteit strafbaar stellen; illegalen vastzetten en uitzetten.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'd6557e86-bff0-4420-96e1-b813e679cf2c',
    expectedVoteDirection: 'VOOR',
    pageRef: '8',
  },

  // ── ECONOMIE / KOOPKRACHT ───────────────────────────────
  {
    promiseCode: 'PVV-2023-005',
    text: 'De PVV wil dat de huren worden verlaagd.',
    summary: 'Huurverlaging doorvoeren voor huurders.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: '69b24523-5f7c-4248-8e85-3c35539aada1',
    expectedVoteDirection: 'VOOR',
    pageRef: '19',
  },
  {
    promiseCode: 'PVV-2023-006',
    text: 'Het eigen risico in de zorg wordt afgeschaft.',
    summary: 'Eigen risico in de zorg volledig afschaffen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '46011d84-96d6-47ac-9fe5-8bde74148ad3',
    expectedVoteDirection: 'VOOR',
    pageRef: '16',
  },
  {
    promiseCode: 'PVV-2023-007',
    text: 'De AOW-leeftijd gaat terug naar 65 jaar.',
    summary: 'AOW-leeftijd terugbrengen naar 65 jaar.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: '3b7ddc39-bd1c-419b-b7a9-c80d57746345',
    expectedVoteDirection: 'VOOR',
    pageRef: '10',
  },

  // ── KLIMAAT / ENERGIE ───────────────────────────────────
  {
    promiseCode: 'PVV-2023-008',
    text: 'Klimaatwet, alle klimaat- en stikstofmaatregelen en het Klimaatfonds worden geschrapt.',
    summary: 'Klimaatwet intrekken en alle klimaat- en stikstofmaatregelen schrappen, inclusief Klimaatfonds.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '5237eda0-c283-461d-a3e6-8d1d7ae48fe2',
    expectedVoteDirection: 'VOOR',
    pageRef: '22',
  },
  {
    promiseCode: 'PVV-2023-009',
    text: 'Geen windmolens, geen zonneparken op land en op zee.',
    summary: 'Verbod op windmolens en zonneparken, zowel op land als op zee.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '5237eda0-c283-461d-a3e6-8d1d7ae48fe2',
    expectedVoteDirection: 'VOOR',
    pageRef: '22',
  },
  {
    promiseCode: 'PVV-2023-010',
    text: 'Wel kerncentrales bouwen.',
    summary: 'Bouwen van kerncentrales als alternatief voor wind- en zonne-energie.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '5237eda0-c283-461d-a3e6-8d1d7ae48fe2',
    expectedVoteDirection: 'VOOR',
    pageRef: '22',
  },

  // ── LANDBOUW ────────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-011',
    text: 'De stikstofregels moeten van tafel. Geen gedwongen uitkoop van boeren.',
    summary: 'Stikstofregels afschaffen en geen gedwongen uitkoop van boeren.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '10137df1-41eb-4e65-9807-9da28e916b30',
    expectedVoteDirection: 'VOOR',
    pageRef: '25',
  },

  // ── VEILIGHEID ──────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-012',
    text: '10.000 extra agenten, minimumstraffen, zwaardere straffen en meer cellen.',
    summary: '10.000 extra politieagenten, minimumstraffen invoeren en meer cellen bouwen.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: 'a2c4e3d3-9bea-411d-8594-01409a993fd9',
    expectedVoteDirection: 'VOOR',
    pageRef: '13',
  },

  // ── DEMOCRATIE ──────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-013',
    text: 'Bindend referendum.',
    summary: 'Invoering van een bindend referendum.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '61efcc2a-cb13-49fd-a88b-48d9c5004f51',
    expectedVoteDirection: 'VOOR',
    pageRef: '29',
  },

  // ── DEFENSIE ────────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-014',
    text: 'Structureel meer geld voor Defensie. De NAVO-norm (2% bbp) moet minimaal worden gehaald.',
    summary: 'Structureel meer geld voor defensie; minimaal de NAVO-norm van 2% bbp halen.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: '894210aa-31f5-4bbd-a816-7bae306eb102',
    expectedVoteDirection: 'VOOR',
    pageRef: '36',
  },

  // ── BUITENLAND ──────────────────────────────────────────
  {
    promiseCode: 'PVV-2023-015',
    text: 'Hierover houden we een bindend referendum. Zolang het referendum over Nexit nog niet gehouden is, zetten wij in op het terughalen van onze miljarden uit Brussel.',
    summary: 'Bindend referendum over Nexit; in de tussentijd terughalen van Nederlandse miljarden uit de EU.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '19a90046-df80-42b3-93e5-7d4c60a7d11f',
    expectedVoteDirection: 'VOOR',
    pageRef: '40',
  },
];

export async function seedPvvPromises(): Promise<void> {
  console.log('[SEED] Starting PVV TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'PVV' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('PVV 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found PVV 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of PVV_PROMISES) {
      const passage = await prisma.programPassage.findUnique({
        where: { id: promise.passageId },
      });

      if (!passage) {
        console.warn(`[SEED] ⚠ Passage ${promise.passageId} not found, skipping ${promise.promiseCode}`);
        continue;
      }

      await prisma.promise.upsert({
        where: {
          programId_promiseCode: {
            programId: program.id,
            promiseCode: promise.promiseCode,
          },
        },
        update: {
          text: promise.text,
          summary: promise.summary,
          theme: promise.theme as any,
          specificity: promise.specificity as any,
          pageRef: promise.pageRef,
          passageId: promise.passageId,
          expectedVoteDirection: promise.expectedVoteDirection,
          extractedBy: 'manual-seed-v1',
        },
        create: {
          programId: program.id,
          promiseCode: promise.promiseCode,
          text: promise.text,
          summary: promise.summary,
          theme: promise.theme as any,
          specificity: promise.specificity as any,
          pageRef: promise.pageRef,
          passageId: promise.passageId,
          expectedVoteDirection: promise.expectedVoteDirection,
          extractedBy: 'manual-seed-v1',
        },
      });

      upserted++;
      console.log(`[SEED] ✅ ${promise.promiseCode}: ${promise.summary.slice(0, 60)}...`);
    }

    console.log(`[SEED] ✅ PVV TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ PVV promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
