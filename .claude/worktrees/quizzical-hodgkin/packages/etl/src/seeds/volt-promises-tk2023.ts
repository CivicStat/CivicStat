/**
 * Seed Volt TK2023 promises extracted from program passages.
 * Volt focuses on pro-EU federalism, ambitious climate (1.5°C), electoral reform,
 * digital rights, European army, circular economy, education investment.
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

const VOLT_PROMISES: PromiseSeed[] = [
  // ── BUITENLAND / EU ───────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-001',
    text: 'Inwoners moeten directer invloed kunnen uitoefenen op de richting die de EU op moet gaan. Volt wil een federale en democratische Europese Unie.',
    summary: 'Federale en democratische EU met meer directe burgerinvloed.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: '30d04698-0411-4a76-ad0f-460f6ce67079',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-002',
    text: 'We breiden het mandaat van Europol uit tot een Europese FBI met eigen opsporingsbevoegdheden tegen grensoverschrijdende criminaliteit.',
    summary: 'Europol uitbreiden tot Europese FBI met eigen opsporingsbevoegdheden.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: '1ddc073a-37f3-4655-b995-fe746785208a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-003',
    text: 'We breiden het gezamenlijk inkopen van materieel uit naar de hele EU. Volt wil inzetten op een gezamenlijk Europees defensiebeleid.',
    summary: 'Gezamenlijk Europees defensiebeleid en materieel inkopen.',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: '0e43498e-b403-4ea8-84b2-cd75cfb676b9',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT ───────────────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-004',
    text: 'Europese aanpak om klimaatneutraliteit en energieonafhankelijkheid te bereiken. Volt wil klimaatneutraal in 2040, vijf jaar eerder dan EU-doel.',
    summary: 'Klimaatneutraal in 2040; Europese aanpak voor energieonafhankelijkheid.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: 'ad40a4ef-1a10-4f92-aa59-9d7d49de69c6',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-005',
    text: 'We verbieden fossiele korteafstandsvluchten tot 650 km. We zetten in op samenwerkingen met buurlanden om het aanbod van treinen te verbeteren.',
    summary: 'Verbod op fossiele korteafstandsvluchten tot 650 km; meer treinen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '810287c2-2ef9-417b-83fd-2bb354a66a8a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-006',
    text: 'We stabiliseren het elektriciteitsnet door meer gebruik te maken van kernenergie, naast hernieuwbare energie.',
    summary: 'Kernenergie inzetten naast hernieuwbare energie voor stabiel net.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '1d5bc4fd-b923-4764-b13c-85827833b221',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE ──────────────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-007',
    text: 'Er wordt een progressieve vermogensbelasting geïntroduceerd voor vermogens boven één miljoen euro.',
    summary: 'Progressieve vermogensbelasting boven één miljoen euro.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '07d9365a-0496-47fe-9d3a-ab0847aee31a',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-008',
    text: 'We willen de belastingontwijking door bedrijven tegengaan met een Europese aanpak. Fiscale regelingen versoberen en belastingconcurrentie bestrijden.',
    summary: 'Belastingontwijking tegengaan via Europese aanpak; fiscale regelingen versoberen.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: 'c0f5ea00-6e73-4259-94b4-9cc45f416205',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-009',
    text: 'We verhogen het minimumloon naar 14 euro per uur, waarbij we een verdere stijging niet uitsluiten.',
    summary: 'Minimumloon verhogen naar 14 euro per uur.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '0f38d8c4-2b1d-436a-b58e-6f52e8919eb4',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ─────────────────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-010',
    text: 'Een nieuw volkshuisvestingfonds wordt ingericht om woningbouwprojecten in de overbelaste markt rond te laten komen.',
    summary: 'Nieuw volkshuisvestingfonds voor betaalbare woningbouw.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '6f8f8d1a-a585-4ede-80ff-9601f87eb110',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR / DEMOCRATIE ──────────────────────────────────
  {
    promiseCode: 'VOLT-2023-011',
    text: 'Er komt een wettelijk verankerde gedragscode met integriteitsregels voor het openbaar bestuur. Een onafhankelijke toezichts- en handhavingsinstantie.',
    summary: 'Wettelijke integriteitsregels openbaar bestuur met onafhankelijk toezicht.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '6733f69a-3358-4229-89dc-546e902f0e51',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'VOLT-2023-012',
    text: 'We verstevigen de generatietoets door er een verplichte verantwoording aan toe te voegen. De generatietoets toetst langetermijneffecten van beleid.',
    summary: 'Verplichte generatietoets op langetermijneffecten van beleid.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '44bd5605-e270-46c4-ac2e-98f38c09752b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── SOCIAAL / DIGITAAL ────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-013',
    text: 'Persoonsgegevens zijn van jezelf en jij mag bepalen óf, met wie en waarom je ze deelt. Volt wil investeren in toezicht en handhaving van privacyrechten.',
    summary: 'Digitale privacyrechten versterken; meer toezicht en handhaving.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: 'f97e64d2-d8fe-465c-9499-36e027456f6c',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-014',
    text: 'Een Europese asiel- en migratieaanpak. Mensen vluchten en mensen migreren. Volt wil een humaan en effectief Europees asielbeleid.',
    summary: 'Humaan Europees asielbeleid met gemeenschappelijke aanpak.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '0f1b0046-24cf-4e15-a740-7f89a1a33fb5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── LANDBOUW ──────────────────────────────────────────────
  {
    promiseCode: 'VOLT-2023-015',
    text: 'Op dit moment worden stikstofrechten door private partijen opgekocht en doorverkocht aan de hoogste bieders. Volt wil dit verbieden.',
    summary: 'Verbod op handel in stikstofrechten door private partijen.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '569d14ce-dfa6-4817-ac04-817d97aacdcb',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedVoltPromises(): Promise<void> {
  console.log('[SEED] Starting Volt TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'Volt' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('Volt 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found Volt 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of VOLT_PROMISES) {
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

    console.log(`[SEED] ✅ Volt TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ Volt promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
