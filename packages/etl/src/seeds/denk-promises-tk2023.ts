/**
 * Seed DENK TK2023 promises extracted from program passages.
 * DENK focuses on anti-discrimination, equal opportunities, diversity,
 * Palestine solidarity, anti-racial profiling, affordable housing, higher wages.
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

const DENK_PROMISES: PromiseSeed[] = [
  // ── SOCIAAL / DISCRIMINATIE ───────────────────────────────
  {
    promiseCode: 'DENK-2023-001',
    text: 'De straffen voor beroepsmatige discriminatie worden substantieel verhoogd. Iedere ambtenaar volgt verplicht inclusie- en diversiteitstrainingen.',
    summary: 'Hogere straffen voor discriminatie; verplichte diversiteitstraining ambtenaren.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: '4593c99a-660c-4a38-a663-3fc10df9557d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'DENK-2023-002',
    text: 'Alle algoritmes moeten verplicht geregistreerd worden. Zodat algoritmen transparant worden en discriminerende algoritmes worden uitgebannen.',
    summary: 'Verplichte registratie van alle algoritmes om discriminatie tegen te gaan.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: '96c580ff-4df2-4172-bb80-e31f5e587dbe',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'DENK-2023-003',
    text: 'Net zoals er een gespecialiseerde kinderrechter is, dient er ook een gespecialiseerde rechter te komen voor gelijke behandeling.',
    summary: 'Gespecialiseerde rechter voor gelijke behandeling instellen.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: 'f2f1f23b-5ddd-41e3-a45e-874839e9febf',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-004',
    text: 'Stop etnisch profileren. De politie moet iedereen gelijk behandelen. DENK wil een verbod op etnisch profileren vastleggen in de wet.',
    summary: 'Wettelijk verbod op etnisch profileren door de politie.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: '79af2a59-b593-4a2e-b776-c06b9a1d4e68',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ONDERWIJS ─────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-005',
    text: 'Onderwijs moet weer de emancipatiemotor worden die het was. Meer investeren in het onderwijs, meer geld voor het onderwijsachterstanden beleid.',
    summary: 'Meer investeren in onderwijs als emancipatiemotor; meer geld voor achterstandenbeleid.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: '9f54654d-44f2-4e36-8a1f-f34095f78790',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'DENK-2023-006',
    text: 'We bevorderen meertalig onderwijs via het initiatief Taalvriendelijke scholen. Meertaligheid is een kracht, geen beperking.',
    summary: 'Meertalig onderwijs bevorderen via Taalvriendelijke scholen.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: 'ebfa078b-bc95-4b25-adaa-91df2dc92db7',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE / SOCIAAL ────────────────────────────────────
  {
    promiseCode: 'DENK-2023-007',
    text: 'In Nederland is de rijkdom niet eerlijk verdeeld. DENK wil eerlijk delen van de welvaart door hogere belasting op grote vermogens.',
    summary: 'Eerlijk delen welvaart; hogere belasting op grote vermogens.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '657f30cf-b09f-4f56-bccd-026183f11efa',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'DENK-2023-008',
    text: 'Bij DENK zijn we van mening dat iedereen die werkt recht heeft op zekerheid, ongeacht de werksituatie. Meer vaste contracten, minder flex.',
    summary: 'Meer vaste contracten; recht op zekerheid voor alle werkenden.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: 'c3212889-199a-45fa-8c88-476f18345b21',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ─────────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-009',
    text: 'Een Minister van Volkshuisvesting. De woningcrisis mag niet langer de toekomst van onze generatie bepalen. Meer betaalbare woningen bouwen.',
    summary: 'Minister van Volkshuisvesting; meer betaalbare woningen bouwen.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: 'b018bcd7-1aac-4bd2-a97e-acafd1504006',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'DENK-2023-010',
    text: 'Woningmarktdiscriminatie aanpakken. Te lang zijn excessen op de woningmarkt geaccepteerd. De woningmarkt reguleren voor bewoners.',
    summary: 'Woningmarktdiscriminatie aanpakken; woningmarkt reguleren.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: 'f64c1367-a5e0-4b0c-9c39-2a4316f66986',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND ────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-011',
    text: 'Producten uit illegale nederzettingen worden geweerd. Er moet een onafhankelijk onderzoek komen naar de politieke steun van Nederland aan Israël.',
    summary: 'Producten uit illegale nederzettingen weren; onderzoek naar steun aan Israël.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '08ac5876-e188-4e10-958b-ad080cc7c2fe',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ──────────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-012',
    text: 'Cultuursensitieve zorg bevordert betere communicatie en begrip tussen zorgverleners en patiënten. DENK wil cultuursensitieve zorg als standaard.',
    summary: 'Cultuursensitieve zorg als standaard in de gezondheidszorg.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '6ca06e0c-5f9b-4ef5-be30-6062440f25cc',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT ───────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-013',
    text: 'De rekening van de energietransitie mag in geen geval terechtkomen bij de gewone burger. Klimaatrealisme: grote vervuilers betalen.',
    summary: 'Klimaatrealisme: energietransitie niet op kosten van gewone burger.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '5c45ef0d-d6f6-4c82-ab35-247198b2d3b7',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR ───────────────────────────────────────────────
  {
    promiseCode: 'DENK-2023-014',
    text: 'De democratie is aan vernieuwing toe. DENK wil naar een vernieuwde democratie met meer directe inspraak en betere vertegenwoordiging.',
    summary: 'Democratische vernieuwing met meer directe inspraak.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: '6bcfadec-0137-4af8-996a-a78afd4ec99a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR / RECHTSSTAAT ─────────────────────────────────
  {
    promiseCode: 'DENK-2023-015',
    text: 'Nooit meer een toeslagenmisdaad. De overheid moet zich voorbeeldig opstellen. Herstel van de rechtsbescherming van burgers.',
    summary: 'Nooit meer toeslagenmisdaad; herstel rechtsbescherming burgers.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: 'c4bdf3cf-b4d0-4420-aa60-a298660ecfa8',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedDenkPromises(): Promise<void> {
  console.log('[SEED] Starting DENK TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'DENK' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('DENK 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found DENK 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of DENK_PROMISES) {
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

    console.log(`[SEED] ✅ DENK TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ DENK promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
