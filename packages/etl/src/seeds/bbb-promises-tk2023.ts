/**
 * Seed BBB TK2023 promises extracted from program passages.
 * BBB's core focus: agriculture/nitrogen, decentralization,
 * rural housing, energy policy, and the 'Noaberstaat'.
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

const BBB_PROMISES: PromiseSeed[] = [
  // ── LANDBOUW / STIKSTOF ─────────────────────────────────
  {
    promiseCode: 'BBB-2023-001',
    text: 'De Wet stikstofreductie en natuurverbetering wordt ingetrokken. De stikstofdoelen worden herijkt op basis van daadwerkelijke staat van de natuur.',
    summary: 'Wet stikstofreductie intrekken en stikstofdoelen herijken op basis van daadwerkelijke natuurstaat.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '029e09cc-41cb-435a-ac9a-fa31f88ab45c',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-002',
    text: 'De voedselproductie in Nederland mag niet worden verplaatst naar landen buiten de EU met lagere duurzaamheidsstandaarden. Wij willen dat voedselzekerheid wettelijk wordt geborgd.',
    summary: 'Voedselzekerheid wettelijk borgen; geen verplaatsing van voedselproductie naar landen met lagere standaarden.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '0d1e43f5-60d8-483a-97cc-acc06f372c9f',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-003',
    text: 'BBB wil geen gedwongen onteigening van boeren en geen halvering van de veestapel.',
    summary: 'Geen gedwongen onteigening van boeren en geen halvering van de veestapel.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '8cbc803f-5018-4fcf-81a7-25aac6eea265',
    expectedVoteDirection: 'TEGEN',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-004',
    text: 'BBB wil de komende tien jaar minstens 100.000 woningen per jaar bijbouwen, evenredig verspreid over het land, met extra aandacht voor buitengebieden.',
    summary: '100.000 woningen per jaar bouwen, evenredig verspreid over het land inclusief buitengebieden.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '00c78039-25f3-4b75-b55a-6b73604d61d8',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-005',
    text: 'Dorpen en kleine kernen moeten weer kunnen groeien. Er komen meer woningen in dorpen en het buitengebied.',
    summary: 'Woningbouw in dorpen en kleine kernen bevorderen; dorpen mogen weer groeien.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: 'eb7f74ad-20d2-4ee5-9278-08d785134274',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-006',
    text: 'Het eigen risico wordt gehalveerd naar 385 euro en op termijn helemaal afgeschaft.',
    summary: 'Eigen risico halveren naar 385 euro en op termijn volledig afschaffen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '5131282d-810b-4abf-88d9-4f19a0cc42d9',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-007',
    text: 'Iedere regio verdient een volwaardig ziekenhuis met spoedeisende hulp en een acute verloskunde-afdeling op aanvaardbare afstand.',
    summary: 'Volwaardig ziekenhuis met SEH en verloskunde in iedere regio op aanvaardbare afstand.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: 'ac9c37f4-7161-4cb8-afbb-74df91c182c5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ────────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-008',
    text: 'De asielinstroom moet drastisch omlaag. BBB wil een tijdelijke asielstop en opvang in de regio.',
    summary: 'Tijdelijke asielstop invoeren en inzetten op opvang in de regio.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: '589f0ec1-7668-45e2-90f5-0ce218b764b8',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-009',
    text: 'Arbeidsmigratie wordt aan strengere regels gebonden. Werkgevers worden verantwoordelijk voor huisvesting en registratie van arbeidsmigranten.',
    summary: 'Strengere regels voor arbeidsmigratie; werkgevers verantwoordelijk voor huisvesting en registratie.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '0753a7f0-003c-4b09-9010-9cbe1dac96b4',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT / ENERGIE ───────────────────────────────────
  {
    promiseCode: 'BBB-2023-010',
    text: 'BBB wil inzetten op kernenergie. Er worden nieuwe kerncentrales gebouwd als betrouwbare bron van CO₂-vrije energie.',
    summary: 'Nieuwe kerncentrales bouwen als betrouwbare bron van CO₂-vrije energie.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '5fa967af-f3b9-446c-b48b-1755322e913f',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'BBB-2023-011',
    text: 'De energierekening moet omlaag. De belasting op energie wordt verlaagd. De btw op energie gaat naar 0%.',
    summary: 'Energiebelasting verlagen en btw op energie naar 0% brengen.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '6c499021-df32-4919-8273-b881428497d6',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ────────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-012',
    text: 'BBB staat voor een sterke Defensie. De NAVO-norm van 2% bbp is het minimum. We streven naar structurele investeringen boven die norm.',
    summary: 'NAVO-norm van 2% bbp als minimum voor defensie; streven naar investeringen daarboven.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: '56f02c6b-847c-4860-88ac-dcf4cc0a0336',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR / DECENTRALISATIE ───────────────────────────
  {
    promiseCode: 'BBB-2023-013',
    text: 'De Noaberstaat: BBB wil meer zeggenschap voor provincies en gemeenten. Decentralisatie van beleid met bijpassend budget.',
    summary: 'Meer zeggenschap voor provincies en gemeenten met bijpassend budget (Noaberstaat).',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: '35bfc0f1-93f6-42a4-b734-56565c3abffb',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ONDERWIJS ───────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-014',
    text: 'BBB wil dat vakonderwijs (vmbo, mbo) dezelfde waardering krijgt als academisch onderwijs. Praktische beroepen zijn de ruggengraat van de samenleving.',
    summary: 'Gelijkwaardige waardering voor vakonderwijs (vmbo, mbo) ten opzichte van academisch onderwijs.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: 'c9978da7-0bde-411c-97c8-0140c6a82e84',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ──────────────────────────────────────────
  {
    promiseCode: 'BBB-2023-015',
    text: 'Meer politie op straat, vooral in de regio. Wijkagenten moeten zichtbaar aanwezig zijn in dorpen en wijken.',
    summary: 'Meer politie op straat in de regio; wijkagenten zichtbaar aanwezig in dorpen en wijken.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: '33359567-177f-4b82-90e6-75a85b01f967',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedBbbPromises(): Promise<void> {
  console.log('[SEED] Starting BBB TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'BBB' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('BBB 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found BBB 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of BBB_PROMISES) {
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

    console.log(`[SEED] ✅ BBB TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ BBB promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
