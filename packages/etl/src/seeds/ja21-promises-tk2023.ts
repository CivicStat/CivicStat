/**
 * Seed JA21 TK2023 promises extracted from program passages.
 * JA21 focuses on strict immigration, pro-nuclear energy, against wind turbines,
 * lower taxes for middle class, law and order, EU-critical but not Nexit, pro-farmers.
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

const JA21_PROMISES: PromiseSeed[] = [
  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-001',
    text: 'JA21 wil met name asielmigratie beperken, gezien de impact die deze vorm van immigratie heeft op ons land. Nederland beloont asielzoekers te veel.',
    summary: 'Asielmigratie beperken; minder beloningen voor asielzoekers.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: 'ce0466da-96f7-417c-8fd1-e771238b0efa',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'JA21-2023-002',
    text: 'Ons land is de grip op arbeidsmigratie volkomen kwijt. Het aantal arbeidsmigranten in Nederland nadert het miljoen. JA21 wil arbeidsmigratie beperken.',
    summary: 'Grip op arbeidsmigratie terugkrijgen; aantal arbeidsmigranten beperken.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '507d4f7e-2b84-40a5-ba39-064a24e2b08f',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ENERGIE / KLIMAAT ─────────────────────────────────────
  {
    promiseCode: 'JA21-2023-003',
    text: 'De weg die JA21 wil inslaan is duidelijk: van instabiele, ontoereikende en horizonvervuilende wind- en zonne-energie naar kernenergie als ruggengraat.',
    summary: 'Kernenergie als ruggengraat; minder wind- en zonne-energie.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '9d4fd5ea-5419-4479-aa64-289768a2f293',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'JA21-2023-004',
    text: 'Het ideologisch gedreven Europese en Nederlandse energiebeleid heeft een grote negatieve impact. Betaalbaarheid moet het sleutelwoord zijn.',
    summary: 'Betaalbare energie als prioriteit; stop ideologisch energiebeleid.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '3c9ec1cd-d4f0-4f81-91b3-0ed0e3dbdc78',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE ──────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-005',
    text: 'De inkomstenbelasting wordt sterk vereenvoudigd. Werken moet meer lonen. Lagere belastingen voor middeninkomens.',
    summary: 'Inkomstenbelasting vereenvoudigen; lagere belasting voor middeninkomens.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '88e45fff-4dea-4a78-8239-0e0582cf22a6',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'JA21-2023-006',
    text: 'JA21 wil dat de meeste Nederlanders zich niet langer hoeven druk te maken over vermogensbelasting. Vermogen waar al belasting over is betaald ontzien.',
    summary: 'Vermogen waar al belasting over is betaald zoveel mogelijk ontzien.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: 'ea394176-cde3-459c-8b4f-cb1e340bcdef',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-007',
    text: 'Een veilig Nederland door investeringen in politie en justitie, een keihard offensief tegen de georganiseerde misdaad. Strenger straffen.',
    summary: 'Investeren in politie en justitie; strenger straffen; aanpak georganiseerde misdaad.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: '9cbf549a-7f54-42c5-97cf-e47e1345c092',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'JA21-2023-008',
    text: 'Het risico op een terroristische aanslag in Nederland blijft groot. JA21 wil een harde aanpak van terrorisme en radicalisering.',
    summary: 'Harde aanpak terrorisme en radicalisering.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: 'be7ac1ba-4c84-45b6-a837-008f5173fa23',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ─────────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-009',
    text: 'De woningmarkt van het slot, bouwen voor onze nieuwe generaties. JA21 wil zorgen dat vraag en aanbod op de woningmarkt in balans komen.',
    summary: 'Woningmarkt vlottrekken; meer bouwen voor nieuwe generaties.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: '33c7738d-f62f-403d-bfab-d1c1feb3e501',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── LANDBOUW ──────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-010',
    text: 'JA21 heeft een initiatiefnota gepresenteerd om de grote knelpunten in de huidige Stikstofwet op te lossen. Boeren verdienen toekomstperspectief.',
    summary: 'Stikstofwet hervormen; toekomstperspectief voor boeren.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '6c39429d-e7f9-4846-bf3c-8c0df7ef4a43',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'JA21-2023-011',
    text: 'De natuuurherstelwet schrijft voor dat de natuur van alle EU-landen moet worden hersteld. JA21 verzet zich tegen deze wet die boeren en bouw raakt.',
    summary: 'Verzet tegen EU-natuurherstelwet die boeren en bouw raakt.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: 'dae74200-5624-4baa-8249-d41982f04a5b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ──────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-012',
    text: 'JA21 wil fors investeren in een krijgsmacht die ook in de toekomst in staat zal zijn om de Nederlandse belangen te beschermen.',
    summary: 'Fors investeren in de krijgsmacht voor bescherming Nederlandse belangen.',
    theme: 'DEFENSIE',
    specificity: 'DIRECTIONAL',
    passageId: 'c1c52578-b0f5-4d03-ad6a-eee3d82f8915',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND / EU ───────────────────────────────────────
  {
    promiseCode: 'JA21-2023-013',
    text: 'JA21 wil een sterke gemeenschappelijke markt voor meer banen en welvaart, maar geen verdere politieke integratie van de EU.',
    summary: 'Sterke EU-markt maar geen verdere politieke integratie.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: '5ff7f22a-3369-47ea-8bc8-7256a6bbe343',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ZORG ──────────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-014',
    text: 'Een duurzame herinrichting zodat Nederlanders verzekerd blijven van betaalbare, toegankelijke en beschikbare zorg. Meer handen aan het bed.',
    summary: 'Betaalbare en toegankelijke zorg; meer handen aan het bed.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '810d12c8-d68d-45b9-9a68-621faa9759ab',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR ───────────────────────────────────────────────
  {
    promiseCode: 'JA21-2023-015',
    text: 'De Nederlandse bevolking is te weinig betrokken bij het politieke beleid. JA21 richt zich op meer democratische betrokkenheid van burgers.',
    summary: 'Meer democratische betrokkenheid en inspraak van burgers.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: 'c138adff-cd5b-4cbb-99d7-5b18bcdc9f94',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedJa21Promises(): Promise<void> {
  console.log('[SEED] Starting JA21 TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'JA21' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('JA21 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found JA21 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of JA21_PROMISES) {
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

    console.log(`[SEED] ✅ JA21 TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ JA21 promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
