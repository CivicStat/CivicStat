/**
 * Seed NSC TK2023 promises extracted from program passages.
 * NSC focuses on good governance, constitutional reform,
 * bestaanszekerheid, housing, and responsible migration.
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

const NSC_PROMISES: PromiseSeed[] = [
  // ── BESTUUR ─────────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-001',
    text: 'De informatie die de regering verstrekt aan de Kamer over beleid en uitvoering moet juist, tijdig en volledig zijn. Wij willen een actieve informatieplicht van de regering richting het parlement wettelijk verankeren.',
    summary: 'Actieve informatieplicht van de regering richting het parlement wettelijk verankeren.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: 'bb4d1ca1-4037-4c85-bbbe-1e73b48d7a6e',
    expectedVoteDirection: 'VOOR',
    pageRef: '9',
  },
  {
    promiseCode: 'NSC-2023-002',
    text: 'Coalitieakkoorden moeten zich beperken tot hoofdlijnen van beleid en financiële kaders. We streven dus naar een beknopt regeerakkoord.',
    summary: 'Beknopte regeerakkoorden op hoofdlijnen in plaats van dichtgetimmerde coalitieafspraken.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: '8549481e-a869-41fc-a612-9f8bf4c5a61d',
    expectedVoteDirection: 'VOOR',
    pageRef: '10',
  },
  {
    promiseCode: 'NSC-2023-003',
    text: 'Voor burgers moet het eenvoudiger zijn om gemaakte (procedurele) fouten laagdrempelig en in alle fases te herstellen of bijzondere omstandigheden te melden. Wij willen een correctiemogelijkheid (de zogeheten \'burgerlus\') opnemen in de Algemene wet bestuursrecht.',
    summary: 'Correctiemogelijkheid (\'burgerlus\') opnemen in de Algemene wet bestuursrecht.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: '5e5febd9-4316-4a3b-815b-9d40a810749c',
    expectedVoteDirection: 'VOOR',
    pageRef: '8',
  },

  // ── SOCIAAL / BESTAANSZEKERHEID ─────────────────────────
  {
    promiseCode: 'NSC-2023-004',
    text: 'Bestaanszekerheid betekent allereerst dat we het wettelijk minimumloon en de daaraan gekoppelde uitkeringen herijken. Het inkomen van huishoudens uit arbeid moet ten minste \'toereikend\' zijn om in de basisbehoeften te kunnen voorzien.',
    summary: 'Wettelijk minimumloon en uitkeringen herijken zodat basisbehoeften betaalbaar zijn.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: 'b1fe043a-3396-4442-a1c3-9eec82b923c8',
    expectedVoteDirection: 'VOOR',
    pageRef: '13',
  },
  {
    promiseCode: 'NSC-2023-005',
    text: 'De sterkste schouders dienen de zwaarste lasten te dragen. Het is in ons huidige stelsel moeilijk om uit te leggen dat mensen die in staat zijn meer bij te dragen, dat niet doen.',
    summary: 'Draagkrachtprincipe in belastingbeleid versterken: sterkste schouders dragen zwaarste lasten.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: 'ab86c8eb-ec29-4fa4-ae99-6bc07bc131e8',
    expectedVoteDirection: 'VOOR',
    pageRef: '14',
  },
  {
    promiseCode: 'NSC-2023-006',
    text: 'De AOW blijft de basis onder het pensioenstelsel. Wij willen het aantal mensen dat nauwelijks of geen aanvullend pensioen opbouwt terugdringen.',
    summary: 'AOW als basis van pensioenstelsel behouden en aanvullend pensioen bevorderen.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '64a1676f-6599-4fa6-ae33-5cadcc9369b4',
    expectedVoteDirection: 'VOOR',
    pageRef: '15',
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-007',
    text: 'De regering dient met een minister van Volkshuisvesting en Ruimtelijke Ordening de regie op de volkshuisvesting te voeren.',
    summary: 'Minister van Volkshuisvesting en Ruimtelijke Ordening instellen voor regie op woningbouw.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: 'a6eb9668-b296-4ad0-8b66-03b84f0a6770',
    expectedVoteDirection: 'VOOR',
    pageRef: '18',
  },
  {
    promiseCode: 'NSC-2023-008',
    text: 'We willen afspraken maken met woningbouwcorporaties zodat zij ten minste 350.000 huurwoningen realiseren.',
    summary: 'Woningcorporaties tenminste 350.000 huurwoningen laten realiseren.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '7b203d20-609b-415d-bba8-731e891b6318',
    expectedVoteDirection: 'VOOR',
    pageRef: '19',
  },

  // ── MIGRATIE ────────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-009',
    text: 'Wij pleiten voor een bewust, actief en selectief migratiebeleid, dat rekening houdt met de draagkracht van de Nederlandse samenleving. Hierbij past naar onze mening een richtgetal voor een migratiesaldo van maximaal 50.000 per jaar.',
    summary: 'Richtgetal van maximaal 50.000 migratiesaldo per jaar invoeren.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: '837f4e85-00e0-41fd-9596-83a85d7a9be0',
    expectedVoteDirection: 'VOOR',
    pageRef: '23',
  },
  {
    promiseCode: 'NSC-2023-010',
    text: 'Er komt een Wet verantwoorde migratie die de regering verplicht om aanvullende maatregelen te nemen om de toestroom te verminderen, zodra het maximale migratiesaldo in beeld komt.',
    summary: 'Wet verantwoorde migratie invoeren die de regering verplicht tot maatregelen bij hoog migratiesaldo.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'f1064166-9ef0-438b-ab42-3a48751876e9',
    expectedVoteDirection: 'VOOR',
    pageRef: '24',
  },
  {
    promiseCode: 'NSC-2023-011',
    text: 'We willen het tweestatusstelsel opnieuw invoeren, ofwel onderscheid maken tussen vluchtelingen en subsidiair beschermden.',
    summary: 'Tweestatusstelsel herinvoeren: onderscheid tussen vluchtelingen en subsidiair beschermden.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'd2b409fe-a6e3-4dc1-bb55-a038f38efd1f',
    expectedVoteDirection: 'VOOR',
    pageRef: '25',
  },
  {
    promiseCode: 'NSC-2023-012',
    text: 'De instroom van buitenlandse studenten wordt gerelateerd aan de beschikbare capaciteit aan woonruimte en opleidingsplaatsen in studentensteden.',
    summary: 'Instroom buitenlandse studenten koppelen aan beschikbare woonruimte en opleidingsplaatsen.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '9595d134-f0a8-4bca-b91a-1f8209f8a7bb',
    expectedVoteDirection: 'VOOR',
    pageRef: '26',
  },

  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-013',
    text: 'Wij willen de groeiende greep van commerciële investeerders op huisartsenpraktijken, tandartspraktijken, apotheken, verpleeghuizen, fysiotherapieketens en privéklinieken terugdringen.',
    summary: 'Commerciële investeerders terugdringen uit huisartsenpraktijken, apotheken en verpleeghuizen.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '0f828785-06d4-4c14-881f-f1246245970a',
    expectedVoteDirection: 'VOOR',
    pageRef: '46',
  },

  // ── KLIMAAT ─────────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-014',
    text: 'De bewoonbaarheid van ons land en de kwaliteit van het leefmilieu zijn essentiële onderdelen van de bestaanszekerheid op langere termijn.',
    summary: 'Leefomgeving en klimaatbeleid als onderdeel van bestaanszekerheid op de lange termijn.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: 'b9d9f1bd-fdde-41a0-9c34-ea61726201f3',
    expectedVoteDirection: 'VOOR',
    pageRef: '50',
  },

  // ── ONDERWIJS ───────────────────────────────────────────
  {
    promiseCode: 'NSC-2023-015',
    text: 'We willen het beroepsonderwijs als gelijkwaardige leerroute positioneren naast het hoger onderwijs. De financiering van het mbo moet structureel worden verbeterd.',
    summary: 'Beroepsonderwijs als gelijkwaardige leerroute positioneren en mbo-financiering structureel verbeteren.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: 'b0473d95-6ab2-4729-9c04-e6b1660bdd30',
    expectedVoteDirection: 'VOOR',
    pageRef: '34',
  },
];

export async function seedNscPromises(): Promise<void> {
  console.log('[SEED] Starting NSC TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'Nieuw Sociaal Contract' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('NSC 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found NSC 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of NSC_PROMISES) {
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

    console.log(`[SEED] ✅ NSC TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ NSC promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
