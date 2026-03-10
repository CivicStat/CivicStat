/**
 * Seed FvD TK2023 promises extracted from program passages.
 * FvD focuses on EU exit (Nexit), direct democracy, climate skepticism,
 * anti-immigration, medical autonomy, and lower taxes.
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

const FVD_PROMISES: PromiseSeed[] = [
  // ── BUITENLAND / EU ───────────────────────────────────────
  {
    promiseCode: 'FVD-2023-001',
    text: 'We sturen aan op intelligente uittreding uit de Europese Unie. Er komt een bindend referendum over het EU-lidmaatschap van Nederland.',
    summary: 'Nexit-referendum: bindend referendum over EU-lidmaatschap.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '0889547c-5af1-48b8-a6c5-7cb7cde2e721',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'FVD-2023-002',
    text: 'Geen nieuwe soevereiniteitsoverdracht; terughalen van overgedragen soevereiniteit. Het monistisch stelsel omzetten naar een dualistisch stelsel.',
    summary: 'Geen nieuwe soevereiniteitsoverdracht aan de EU; overgedragen bevoegdheden terughalen.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '8c2db095-a9d2-4fe3-9845-9cee4f98a95b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR / DEMOCRATIE ──────────────────────────────────
  {
    promiseCode: 'FVD-2023-003',
    text: 'We geven macht terug aan de burger via de onmiddellijke invoering van (bindende) referenda naar Zwitsers model.',
    summary: 'Bindende referenda invoeren naar Zwitsers model.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '17ae8d71-d8ba-4afb-95dd-bf38f0c44184',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'FVD-2023-004',
    text: 'We willen gekozen Burgemeesters, gekozen Commissarissen van de Koning en een gekozen minister-president.',
    summary: 'Gekozen burgemeesters, commissarissen en minister-president.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: 'ff2a723d-fe33-447c-a983-4fa52651be1a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT / ENERGIE ─────────────────────────────────────
  {
    promiseCode: 'FVD-2023-005',
    text: 'We stoppen met alle vormen van klimaatbeleid, stikstofbeleid en duurzaamheid. Om energie weer betaalbaar te maken zetten we in op kernenergie en aardgas.',
    summary: 'Stoppen met klimaat- en stikstofbeleid; inzetten op kernenergie en aardgas.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '4220d270-de45-4fd3-a320-dc3dc386369a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'FVD-2023-006',
    text: 'De huidige klimaatdoelen zijn onhaalbaar. We stappen uit het Klimaatakkoord van Parijs en schrappen alle klimaatsubsidies.',
    summary: 'Uit het Klimaatakkoord van Parijs stappen en klimaatsubsidies schrappen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '000c318b-0a03-442c-9d15-f611101c192a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'FVD-2023-007',
    text: 'We stellen een naturalisatiestop in van ten minste 10 jaar. De overheid biedt steun aan immigranten die willen terugkeren naar hun land van herkomst.',
    summary: 'Naturalisatiestop van minimaal 10 jaar en remigratie stimuleren.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: '4c53a476-549c-42cc-9932-2bd3bf6f4b95',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VRIJHEID / ZORG ───────────────────────────────────────
  {
    promiseCode: 'FVD-2023-008',
    text: 'We dienen een Vrijheidswet in die het onmogelijk maakt voor toekomstige regeringen om ooit nog lockdowns, avondklokken of andere vrijheidsbeperkende maatregelen in te voeren.',
    summary: 'Vrijheidswet: verbod op lockdowns en andere vrijheidsbeperkende maatregelen.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: 'c0c61cb4-edca-4359-bfe8-b7c532737e5b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'FVD-2023-009',
    text: 'We trekken meer geld uit voor verpleegkundigen en maken een einde aan de bureaucratische rompslomp in de zorg.',
    summary: 'Meer geld voor verpleegkundigen en minder bureaucratie in de zorg.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: 'cc73c70b-3796-4b7b-a749-68d3c25837d0',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE ──────────────────────────────────────────────
  {
    promiseCode: 'FVD-2023-010',
    text: 'Er komt een wettelijk recht op cashbetalingen en een verplichting voor banken om banktegoeden van klanten kostenloos beschikbaar te stellen in contanten.',
    summary: 'Wettelijk recht op cashbetalingen invoeren.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '977530c3-c6e1-4b79-b9f2-49d6d8f3ca71',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'FVD-2023-011',
    text: 'We verlagen de lasten voor MKB en ZZP en maken een eind aan de regelzucht die ondernemers het werken onmogelijk maakt.',
    summary: 'Belastingverlaging voor MKB en ZZP; minder regeldruk.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '4f4cab67-f5ea-4bd0-bfc0-bde630fe8a63',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ONDERWIJS ─────────────────────────────────────────────
  {
    promiseCode: 'FVD-2023-012',
    text: 'Bijscholing voor docenten gericht op verhoging van het algeheel onderwijspeil. We geven het onderwijs terug aan de leraren.',
    summary: 'Deltaplan onderwijs: hogere kwaliteit en meer autonomie voor leraren.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: 'bb653452-389c-47f3-a374-5ffa7ea727e7',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── SOCIAAL ───────────────────────────────────────────────
  {
    promiseCode: 'FVD-2023-013',
    text: 'Er komt een verbod op transgender-propaganda op scholen en in tv-programma\'s voor de jeugd.',
    summary: 'Verbod op transgender-voorlichting op scholen en in jeugd-tv.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: 'ff9d6d9c-84fb-4293-8691-fc330bdfec6b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── LANDBOUW ──────────────────────────────────────────────
  {
    promiseCode: 'FVD-2023-014',
    text: 'Er is geen stikstofprobleem. Inkrimping van de veestapel is onnodig: boeren kunnen gewoon blijven boeren.',
    summary: 'Geen stikstofprobleem: veestapel niet inkrimpen, boeren laten boeren.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '449b3956-eebb-4558-945d-7b498d884d2b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE / BUITENLAND ─────────────────────────────────
  {
    promiseCode: 'FVD-2023-015',
    text: 'Nederland treedt op als mediator om vredesonderhandelingen mogelijk te maken tussen Rusland en Oekraïne. We stoppen de wapenleveranties.',
    summary: 'Vredesonderhandelingen Rusland-Oekraïne; stoppen met wapenleveranties.',
    theme: 'BUITENLAND',
    specificity: 'CONCRETE',
    passageId: '56245d74-7095-43f3-ad3b-3564e1d780f9',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedFvdPromises(): Promise<void> {
  console.log('[SEED] Starting FvD TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: {
          OR: [
            { abbreviation: 'FVD' },
            { abbreviation: 'FvD' },
            { name: { contains: 'Forum voor Democratie', mode: 'insensitive' } },
          ],
        },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('FvD 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found FvD 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of FVD_PROMISES) {
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

    console.log(`[SEED] ✅ FvD TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ FvD promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
