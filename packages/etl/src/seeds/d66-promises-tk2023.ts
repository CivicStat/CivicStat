/**
 * Seed D66 TK2023 promises extracted from program passages.
 * D66 focuses on climate, education, Europe, progressive-liberal
 * values, and medical-ethical issues.
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

const D66_PROMISES: PromiseSeed[] = [
  // ── KLIMAAT ─────────────────────────────────────────────
  {
    promiseCode: 'D66-2023-001',
    text: 'D66 wil de CO₂-uitstoot in 2030 met ten minste 60% reduceren ten opzichte van 1990. Nederland wordt uiterlijk in 2040 klimaatneutraal.',
    summary: 'CO₂-uitstoot 60% verlagen in 2030; Nederland klimaatneutraal in 2040.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '2880c311-4941-4a45-99eb-40343ed36be3',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-002',
    text: 'Er komt een Klimaatticket: een betaalbaar OV-abonnement waarmee je door heel Nederland kunt reizen.',
    summary: 'Betaalbaar Klimaatticket invoeren voor landelijk OV-reizen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '585e032f-0772-4818-8bd1-6a12d81ed778',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-003',
    text: 'D66 is geen voorstander van nieuwe kerncentrales in Nederland. We zetten in op zon, wind en groene waterstof.',
    summary: 'Geen nieuwe kerncentrales; inzet op zon, wind en groene waterstof.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: 'e19c4d7a-9453-42ed-a3bd-a540c667c968',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },

  // ── ONDERWIJS ───────────────────────────────────────────
  {
    promiseCode: 'D66-2023-004',
    text: 'Kinderopvang wordt voor alle werkende ouders gratis toegankelijk. Kinderopvang is een basisvoorziening, geen luxeproduct.',
    summary: 'Gratis kinderopvang voor alle werkende ouders als basisvoorziening.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: 'd04703f7-9d94-4ec9-a1bd-b2e98cd03d5d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-005',
    text: 'Leraren verdienen een hoger salaris. D66 wil dat het lerarensalaris in het primair onderwijs gelijk wordt getrokken met het voortgezet onderwijs.',
    summary: 'Lerarensalaris in primair onderwijs gelijktrekken met voortgezet onderwijs.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '48297827-88fc-4e29-966c-7d94b23e0178',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'D66-2023-006',
    text: 'D66 wil dat er jaarlijks minstens 100.000 nieuwe woningen worden gebouwd, waarvan een groot deel betaalbare huur- en koopwoningen.',
    summary: 'Jaarlijks minstens 100.000 nieuwe woningen bouwen, grotendeels betaalbaar.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '939278b9-8e70-4bde-af0c-1140fedc4b37',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-007',
    text: 'D66 wil de hypotheekrenteaftrek geleidelijk afbouwen en de vrijgekomen middelen investeren in woningbouw.',
    summary: 'Hypotheekrenteaftrek geleidelijk afbouwen; opbrengsten investeren in woningbouw.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: '68fc0a14-b4ea-4fb3-a75e-2676ab24e359',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'D66-2023-008',
    text: 'Het eigen risico wordt gehalveerd. Tandartszorg tot 21 jaar wordt opgenomen in het basispakket.',
    summary: 'Eigen risico halveren en tandartszorg tot 21 jaar in het basispakket opnemen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '8c9e1f23-ad84-4ddc-a5ca-09e109d0ce4a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MEDISCH-ETHISCH ─────────────────────────────────────
  {
    promiseCode: 'D66-2023-009',
    text: 'D66 wil het recht op abortus in de Grondwet verankeren. De verplichte bedenktijd van vijf dagen wordt afgeschaft.',
    summary: 'Recht op abortus in de Grondwet verankeren en verplichte bedenktijd afschaffen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '3c973d78-36ed-479a-b1c8-05c004ab389b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-010',
    text: 'Er komt een wet die voltooid-levenwetgeving mogelijk maakt voor ouderen die hun leven als voltooid beschouwen.',
    summary: 'Voltooid-levenwetgeving mogelijk maken voor ouderen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '3c973d78-36ed-479a-b1c8-05c004ab389b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'D66-2023-011',
    text: 'D66 wil wetenschappelijk onderzoek met embryo\'s toestaan om ernstige erfelijke ziekten te behandelen.',
    summary: 'Wetenschappelijk onderzoek met embryo\'s toestaan voor behandeling erfelijke ziekten.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '521d35e0-b96a-46d9-9d00-485e4d20b751',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR ─────────────────────────────────────────────
  {
    promiseCode: 'D66-2023-012',
    text: 'D66 wil het actief kiesrecht verlagen naar 16 jaar, zodat jongeren eerder kunnen meebeslissen over hun toekomst.',
    summary: 'Stemrecht verlagen naar 16 jaar.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '6fad40bf-1f99-43ef-bd28-45f34114e06e',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND / EUROPA ─────────────────────────────────
  {
    promiseCode: 'D66-2023-013',
    text: 'D66 wil een sterker Europa met meer slagkracht. Het vetorecht in de Europese Raad wordt afgeschaft op terreinen als buitenlands beleid en belastingen.',
    summary: 'Vetorecht in de Europese Raad afschaffen op buitenlands beleid en belastingen.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '569821f2-2815-46d4-bbff-3f85e7f5cc89',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID / DRUGS ──────────────────────────────────
  {
    promiseCode: 'D66-2023-014',
    text: 'D66 wil de teelt en verkoop van cannabis volledig reguleren. Dit biedt een betere bescherming van de volksgezondheid en ondermijnt de georganiseerde misdaad.',
    summary: 'Teelt en verkoop van cannabis volledig reguleren.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: 'acd4a511-d736-42b0-aab1-e861f27dd654',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ────────────────────────────────────────────
  {
    promiseCode: 'D66-2023-015',
    text: 'D66 staat achter de NAVO-norm van 2% bbp voor defensie en wil toewerken naar meer Europese defensiesamenwerking.',
    summary: 'NAVO-norm van 2% bbp halen en meer Europese defensiesamenwerking nastreven.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: '8102fa74-5a95-40bc-845a-52e4b32b2a5d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedD66Promises(): Promise<void> {
  console.log('[SEED] Starting D66 TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'D66' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('D66 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found D66 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of D66_PROMISES) {
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

    console.log(`[SEED] ✅ D66 TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ D66 promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
