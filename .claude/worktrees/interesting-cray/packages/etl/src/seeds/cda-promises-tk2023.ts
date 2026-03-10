/**
 * Seed CDA TK2023 promises extracted from program passages.
 * CDA focuses on family values, community, agriculture,
 * security, green industrial policy, and European cooperation.
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

const CDA_PROMISES: PromiseSeed[] = [
  // ── SOCIAAL / GEZINNEN ──────────────────────────────────
  {
    promiseCode: 'CDA-2023-001',
    text: 'Het CDA wil een kindgebonden budget dat gezinnen met kinderen beter ondersteunt. Kinderopvang moet betaalbaar en toegankelijk zijn voor alle ouders.',
    summary: 'Kindgebonden budget verbeteren en kinderopvang betaalbaar maken voor alle ouders.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '8894de63-e1f1-4972-90e6-c0b588301799',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CDA-2023-002',
    text: 'De jeugdzorg wordt hervormd. Gemeenten krijgen de ruimte om gezinnen vroegtijdig te helpen, met minder bureaucratie en meer menselijke maat.',
    summary: 'Jeugdzorg hervormen: minder bureaucratie, meer ruimte voor gemeenten om gezinnen vroegtijdig te helpen.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: 'd2639486-81c2-438e-96af-0b9989027141',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE / BESTAANSZEKERHEID ────────────────────────
  {
    promiseCode: 'CDA-2023-003',
    text: 'Het CDA wil de bestaanszekerheid van alle Nederlanders verbeteren. Werken moet altijd lonen: het verschil tussen werken en niet-werken moet groter worden.',
    summary: 'Bestaanszekerheid verbeteren; het verschil tussen werken en niet-werken vergroten.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '92c1dcf4-8efb-486a-8b8e-dae52d0670d8',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CDA-2023-004',
    text: 'De arbeidsmarkt wordt eerlijker. Vast werk wordt weer de norm. We pakken schijnzelfstandigheid en doorgeslagen flexibilisering aan.',
    summary: 'Vast werk als norm herstellen; schijnzelfstandigheid en doorgeslagen flex aanpakken.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '0ecff6d3-2215-4a32-b8f6-30935c6887d0',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CDA-2023-005',
    text: 'De schuldenindustrie wordt aan banden gelegd. Commerciële incassobureaus mogen niet langer woekerwinsten maken op schulden van kwetsbare mensen.',
    summary: 'Schuldenindustrie aan banden leggen; woekerwinsten van incassobureaus stoppen.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '48f7b973-39be-43df-8dbe-4ab1440f7239',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT / INDUSTRIE ─────────────────────────────────
  {
    promiseCode: 'CDA-2023-006',
    text: 'Het CDA wil een groene industriepolitiek. We investeren in de verduurzaming van de Nederlandse maakindustrie en in innovatie.',
    summary: 'Groene industriepolitiek voeren met investeringen in verduurzaming en innovatie van de maakindustrie.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '2f34efdc-d29a-4164-8d1b-3c4d131764b8',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CDA-2023-007',
    text: 'Het CDA wil een goed vestigingsklimaat voor het midden- en kleinbedrijf. Het mkb is de motor van de Nederlandse economie.',
    summary: 'Vestigingsklimaat verbeteren voor het midden- en kleinbedrijf.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '992343ee-911a-49cd-bcb2-43b60a8ebe9d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-008',
    text: 'Er worden jaarlijks 100.000 nieuwe woningen gebouwd, met een eerlijke verdeling tussen koop, sociale huur en middenhuur.',
    summary: 'Jaarlijks 100.000 woningen bouwen met eerlijke verdeling koop, sociale huur en middenhuur.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '325ae01d-ffd7-4137-8ada-8c3bda4acfbf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── LANDBOUW ────────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-009',
    text: 'Het CDA staat achter onze boeren. Er komt een langjarig perspectief voor de landbouw, met innovatie als sleutel tot verduurzaming, niet met gedwongen krimp.',
    summary: 'Langjarig perspectief voor landbouw met innovatie als sleutel; geen gedwongen krimp.',
    theme: 'LANDBOUW',
    specificity: 'DIRECTIONAL',
    passageId: 'adf56e62-2eae-402d-a2ba-dc692aca9180',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ──────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-010',
    text: 'Het CDA wil harder optreden tegen ondermijning en drugscriminaliteit. Extra investeringen in politie, justitie en de rechterlijke macht.',
    summary: 'Harder optreden tegen ondermijning en drugscriminaliteit; extra investeringen in politie en justitie.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: '325ae01d-ffd7-4137-8ada-8c3bda4acfbf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR / GEMEENSCHAPSZIN ───────────────────────────
  {
    promiseCode: 'CDA-2023-011',
    text: 'Maatschappelijke organisaties, sportverenigingen en kerken zijn het cement van de samenleving. Het CDA wil vrijwilligerswerk beter ondersteunen.',
    summary: 'Vrijwilligerswerk beter ondersteunen; maatschappelijke organisaties als cement van de samenleving.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: 'adf56e62-2eae-402d-a2ba-dc692aca9180',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-012',
    text: 'Het CDA wil het eigen risico bevriezen en op termijn verlagen. Zorg moet betaalbaar en toegankelijk blijven voor iedereen.',
    summary: 'Eigen risico bevriezen en op termijn verlagen; zorg betaalbaar houden.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '5f2d00a8-fce8-4c0b-80b9-bb6d083ed847',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── PENSIOENEN ──────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-013',
    text: 'Het CDA wil een eerlijk pensioen. Pensioenfondsen moeten sneller kunnen indexeren en de overgang naar het nieuwe stelsel mag niet ten koste gaan van oudere deelnemers.',
    summary: 'Pensioenfondsen sneller laten indexeren; overgang nieuw stelsel mag niet ten koste van ouderen.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: 'fe5b3bf0-47b2-4778-81f2-91775a7a9088',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND ──────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-014',
    text: 'Het CDA staat voor een sterk Europa dat samenwerkt op veiligheid, handel en klimaat, maar met respect voor nationale soevereiniteit.',
    summary: 'Sterk Europa op veiligheid, handel en klimaat, met respect voor nationale soevereiniteit.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: 'd72cf5e6-ef58-4245-8d0c-65a89297a288',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ────────────────────────────────────────────
  {
    promiseCode: 'CDA-2023-015',
    text: 'Het CDA wil structureel meer investeren in Defensie. De NAVO-norm van 2% bbp is het absolute minimum.',
    summary: 'Structureel meer investeren in defensie; NAVO-norm van 2% bbp als absoluut minimum.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: '325ae01d-ffd7-4137-8ada-8c3bda4acfbf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedCdaPromises(): Promise<void> {
  console.log('[SEED] Starting CDA TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'CDA' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('CDA 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found CDA 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of CDA_PROMISES) {
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

    console.log(`[SEED] ✅ CDA TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ CDA promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
