/**
 * Seed CU (ChristenUnie) TK2023 promises extracted from program passages.
 * CU focuses on medical ethics, family policy, healthcare,
 * international law, and refugee policy (pro-reception).
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

const CU_PROMISES: PromiseSeed[] = [
  // ── MEDISCH-ETHISCH ─────────────────────────────────────
  {
    promiseCode: 'CU-2023-001',
    text: 'De ChristenUnie wil de bescherming van het ongeboren leven versterken. De abortusgrens wordt niet verruimd en de verplichte bedenktijd blijft gehandhaafd.',
    summary: 'Bescherming ongeboren leven versterken; abortusgrens niet verruimen, bedenktijd handhaven.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '1ddf1c8d-9f97-42b2-83cd-e8582321a76c',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-002',
    text: 'De ChristenUnie is tegen verruiming van de euthanasiewet. Er wordt geïnvesteerd in palliatieve zorg en hospices als waardig alternatief.',
    summary: 'Tegen verruiming euthanasiewet; investeren in palliatieve zorg en hospices.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: 'c702ab56-1deb-45b6-9179-9f3b3edb189f',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-003',
    text: 'De ChristenUnie wil geen verruiming van de Embryowet. Embryo\'s verdienen bescherming en mogen niet gekweekt worden voor wetenschappelijk onderzoek.',
    summary: 'Geen verruiming Embryowet; embryo\'s mogen niet gekweekt worden voor onderzoek.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '3fcf629a-2472-44f5-8844-669b5225df8d',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-004',
    text: 'De Transgenderwet moet zorgvuldig zijn. De ChristenUnie is terughoudend over geslachtsverandering bij minderjarigen en wil goede psychologische begeleiding waarborgen.',
    summary: 'Terughoudendheid bij geslachtsverandering minderjarigen; goede psychologische begeleiding waarborgen.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '37306715-16e9-4230-9f88-278c724ff2f9',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },

  // ── GEZINSBELEID ────────────────────────────────────────
  {
    promiseCode: 'CU-2023-005',
    text: 'De ChristenUnie wil een ruimer verlofstelsel voor ouders. Ouderschapsverlof wordt verlengd en beter betaald, zodat ouders meer tijd hebben voor hun kinderen.',
    summary: 'Ouderschapsverlof verlengen en beter betalen voor meer tijd met kinderen.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '8947f9d1-90f3-42b7-b3cf-e32a68e0d69d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-006',
    text: 'De ChristenUnie pleit voor een vierdaagse werkweek als nieuwe norm, zodat er meer ruimte is voor gezin, mantelzorg en vrijwilligerswerk.',
    summary: 'Vierdaagse werkweek als norm voor meer tijd voor gezin, mantelzorg en vrijwilligerswerk.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '01c93f25-a750-4d83-b096-d7e45cb54c78',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'CU-2023-007',
    text: 'De ChristenUnie wil investeren in de ouderenzorg. Verpleeghuizen moeten genoeg personeel en middelen hebben voor menswaardige zorg.',
    summary: 'Investeren in ouderenzorg: voldoende personeel en middelen voor verpleeghuizen.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '610c89ed-913d-4ce9-8e39-6c354ce3dca2',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-008',
    text: 'De ChristenUnie wil preventie centraal stellen in het zorgstelsel. Voorkomen is beter dan genezen.',
    summary: 'Preventie centraal stellen in het zorgstelsel.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '797a8929-40e8-4719-b2a2-b17c7f8c2856',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'CU-2023-009',
    text: 'De ChristenUnie wil 100.000 woningen per jaar bouwen, met voorrang voor starters en gezinnen.',
    summary: '100.000 woningen per jaar bouwen met voorrang voor starters en gezinnen.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '2bfe0e57-b6f1-407a-8d19-9c7cfac1260d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ONDERWIJS ───────────────────────────────────────────
  {
    promiseCode: 'CU-2023-010',
    text: 'De vrijheid van onderwijs is een grondrecht. Bijzondere scholen behouden hun recht op een eigen toelatings- en benoemingsbeleid.',
    summary: 'Vrijheid van onderwijs als grondrecht behouden; bijzondere scholen houden eigen toelatingsbeleid.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '33d25975-639b-4812-86e5-8b4e689f946b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'CU-2023-011',
    text: 'De ChristenUnie wil kinderen beschermen tegen schadelijke sociale media. Er komt een minimumleeftijd voor sociale media.',
    summary: 'Minimumleeftijd voor sociale media invoeren om kinderen te beschermen.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '9d6d7de0-82d9-4f7c-ae2b-6225f13ed5d0',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE / VLUCHTELINGEN ────────────────────────────
  {
    promiseCode: 'CU-2023-012',
    text: 'De ChristenUnie staat voor een gastvrij en rechtvaardig asielbeleid. Vluchtelingen verdienen een menswaardige opvang en een eerlijke procedure.',
    summary: 'Gastvrij en rechtvaardig asielbeleid met menswaardige opvang en eerlijke procedures.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '6f86cb1c-c6f7-428a-9382-1d2a820be1b5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BELASTING / TOESLAGEN ───────────────────────────────
  {
    promiseCode: 'CU-2023-013',
    text: 'Het toeslagenstelsel wordt hervormd. De ChristenUnie wil een eenvoudiger belastingstelsel met hogere kinderbijslag en minder complexe toeslagen.',
    summary: 'Toeslagenstelsel hervormen: eenvoudiger belastingstelsel met hogere kinderbijslag.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '39b3a521-b2d5-439a-9ca1-af224a2072f2',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT ─────────────────────────────────────────────
  {
    promiseCode: 'CU-2023-014',
    text: 'De ChristenUnie ziet rentmeesterschap als opdracht: we moeten de schepping goed doorgeven. De klimaatdoelen van Parijs zijn het minimum.',
    summary: 'Rentmeesterschap als klimaatopdracht; Parijse klimaatdoelen als minimum.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '1f659a3f-7a0e-4c05-9a23-2f6b73d9fdf0',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ────────────────────────────────────────────
  {
    promiseCode: 'CU-2023-015',
    text: 'De ChristenUnie wil dat Nederland de NAVO-norm van 2% bbp structureel haalt en investeert in een sterkere Europese defensiesamenwerking.',
    summary: 'NAVO-norm van 2% bbp structureel halen; sterkere Europese defensiesamenwerking.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: 'db8c75b7-335f-4c8b-9ab7-addf9845473c',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedCuPromises(): Promise<void> {
  console.log('[SEED] Starting CU TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: {
          OR: [
            { abbreviation: 'CU' },
            { abbreviation: 'ChristenUnie' },
            { name: { contains: 'ChristenUnie', mode: 'insensitive' } },
          ],
        },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('ChristenUnie 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found CU 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of CU_PROMISES) {
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

    console.log(`[SEED] ✅ CU TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ CU promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
