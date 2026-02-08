/**
 * Seed PvdD TK2023 promises extracted from program passages.
 * PvdD focuses on animal rights, climate, agriculture (livestock reduction),
 * biodiversity, anti-biomass, and a plant-based food transition.
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

const PVDD_PROMISES: PromiseSeed[] = [
  // ── DIERENRECHTEN ───────────────────────────────────────
  {
    promiseCode: 'PvdD-2023-001',
    text: 'Dierenrechten worden opgenomen in de Grondwet. Dieren zijn geen eigendom, maar wezens met een eigen intrinsieke waarde.',
    summary: 'Dierenrechten opnemen in de Grondwet; dieren erkennen als wezens met intrinsieke waarde.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '6f3af9fc-08bb-4556-b474-868dd9d66898',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-002',
    text: 'De Partij voor de Dieren wil een einde aan dierproeven. Er wordt geïnvesteerd in proefdiervrije innovatie en alternatieven.',
    summary: 'Einde aan dierproeven; investeren in proefdiervrije innovatie en alternatieven.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '6677ba80-01d9-46b0-bc6e-085e75e9a36a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-003',
    text: 'De intensieve veehouderij wordt afgebouwd. De bio-industrie maakt plaats voor diervriendelijke, kleinschalige landbouw.',
    summary: 'Intensieve veehouderij afbouwen; bio-industrie vervangen door diervriendelijke kleinschalige landbouw.',
    theme: 'LANDBOUW',
    specificity: 'DIRECTIONAL',
    passageId: '29e87cef-e80c-4153-9a8a-edb8af040fca',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT / LANDBOUW ──────────────────────────────────
  {
    promiseCode: 'PvdD-2023-004',
    text: 'De veestapel wordt met 75% verkleind. Dit is nodig om klimaat-, natuur- en stikstofdoelen te halen.',
    summary: 'Veestapel met 75% verkleinen om klimaat-, natuur- en stikstofdoelen te halen.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: 'cfa3386b-d5a2-4215-8030-a73e7a87eced',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-005',
    text: 'De Partij voor de Dieren wil een transitie naar plantaardige landbouw en voedselproductie. Subsidies op dierlijke producten worden afgebouwd.',
    summary: 'Transitie naar plantaardige landbouw; subsidies op dierlijke producten afbouwen.',
    theme: 'LANDBOUW',
    specificity: 'DIRECTIONAL',
    passageId: 'baa13fec-ed63-4e4a-9147-70dd0d23a7bf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT / ENERGIE ───────────────────────────────────
  {
    promiseCode: 'PvdD-2023-006',
    text: 'Er komen geen nieuwe kerncentrales. Kernenergie is duur, gevaarlijk en levert radioactief afval op waarvoor geen oplossing is.',
    summary: 'Geen nieuwe kerncentrales; kernenergie is geen oplossing.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: 'a666fd56-13b5-446f-8705-b35afb125fef',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-007',
    text: 'Het verstoken van biomassa als energiebron wordt verboden. Biomassacentrales worden zo snel mogelijk gesloten.',
    summary: 'Verbod op biomassa als energiebron; biomassacentrales sluiten.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: 'acbbe962-0103-423b-8d9d-74e85509eef3',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-008',
    text: 'Nederland wordt uiterlijk in 2030 klimaatneutraal. De Klimaatwet wordt aangescherpt met een CO₂-reductiedoel van minimaal 75% in 2030.',
    summary: 'Nederland klimaatneutraal in 2030; CO₂-reductie van minimaal 75% in 2030.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '2e8d1f2a-2a57-496f-bc67-bbd6583da425',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── NATUUR / BIODIVERSITEIT ─────────────────────────────
  {
    promiseCode: 'PvdD-2023-009',
    text: 'De stikstofcrisis wordt opgelost door de veestapel drastisch te verkleinen, niet door technische lapmiddelen. Natuur en biodiversiteit krijgen voorrang.',
    summary: 'Stikstofcrisis oplossen via verkleining veestapel; natuur en biodiversiteit krijgen voorrang.',
    theme: 'LANDBOUW',
    specificity: 'DIRECTIONAL',
    passageId: '1d27fbd1-6685-4879-ba8f-309e9f4193c5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-010',
    text: 'Landbouwgif (pesticiden) wordt verboden. Er komt een snelle transitie naar biologische en gifvrije landbouw.',
    summary: 'Pesticiden verbieden; snelle transitie naar biologische en gifvrije landbouw.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: 'b4e89aa1-ac77-483a-9ff2-d15160842b88',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'PvdD-2023-011',
    text: 'Er komt een verbod op genetische manipulatie (gentech) in de landbouw en in het milieu.',
    summary: 'Verbod op genetische manipulatie (gentech) in landbouw en milieu.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: 'c8ca67bc-050f-44da-8b4b-bff475492b48',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'PvdD-2023-012',
    text: 'Het eigen risico wordt afgeschaft. De zorg wordt weer een publieke voorziening zonder winstoogmerk.',
    summary: 'Eigen risico afschaffen en zorg als publieke voorziening zonder winstoogmerk organiseren.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: 'c4761b43-4a47-435a-854e-20dd4bdeb5d6',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'PvdD-2023-013',
    text: 'Er worden jaarlijks 100.000 betaalbare en duurzame woningen gebouwd. Nieuwbouw wordt natuur-inclusief en energieneutraal.',
    summary: 'Jaarlijks 100.000 betaalbare duurzame woningen bouwen; natuur-inclusief en energieneutraal.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: 'd881c272-352e-4f05-89a4-c76919342499',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE ────────────────────────────────────────────
  {
    promiseCode: 'PvdD-2023-014',
    text: 'De Partij voor de Dieren wil een circulaire economie. Oneindige economische groei op een eindige planeet is onmogelijk.',
    summary: 'Transitie naar circulaire economie; afstappen van oneindige economische groei.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: 'f1a3a8a6-714f-43d2-a4f9-657734984baf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ────────────────────────────────────────────
  {
    promiseCode: 'PvdD-2023-015',
    text: 'De Partij voor de Dieren staat voor een humaan vluchtelingenbeleid. Nederland vangt een eerlijk deel van de vluchtelingen op.',
    summary: 'Humaan vluchtelingenbeleid; Nederland vangt een eerlijk deel vluchtelingen op.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: 'dffa9445-ca88-423e-937a-1c36e4a8c8ac',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedPvddPromises(): Promise<void> {
  console.log('[SEED] Starting PvdD TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'PvdD' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('PvdD 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found PvdD 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of PVDD_PROMISES) {
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

    console.log(`[SEED] ✅ PvdD TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ PvdD promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
