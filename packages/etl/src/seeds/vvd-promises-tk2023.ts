/**
 * Seed VVD TK2023 promises extracted from program passages.
 * These are the most distinctive, testable VVD positions from
 * their 2023 election program.
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

const VVD_PROMISES: PromiseSeed[] = [
  // ── DEFENSIE ──────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-001',
    text: 'We bieden defensie zekerheid. We leggen wettelijk vast dat we 2% van ons bbp investeren in defensie. Dit om te voorkomen dat er direct op defensie bezuinigd wordt als de wereld iets veiliger lijkt, en we bij een volgend conflict in Europa eerst jarenlang onze krijgsmacht moeten opbouwen.',
    summary: 'Wettelijk vastleggen dat Nederland minimaal 2% van het bbp investeert in defensie (NAVO-norm).',
    theme: 'DEFENSIE',
    specificity: 'CONCRETE',
    passageId: 'b88ba220-0294-4a52-829b-a15630772298',
    expectedVoteDirection: 'VOOR',
    pageRef: '17',
  },
  {
    promiseCode: 'VVD-2023-002',
    text: 'Sterke Europese NAVO-pijler, maar geen Europees leger. De NAVO is het fundament voor onze internationale veiligheid. Nederland zet verdere stappen om de versnippering van Europese legers tegen te gaan, bijvoorbeeld door bilateraal gezamenlijke eenheden op te richten die we aan de NAVO aanbieden.',
    summary: 'Versterking Europese NAVO-pijler via bilaterale samenwerking, maar geen Europees leger.',
    theme: 'DEFENSIE',
    specificity: 'DIRECTIONAL',
    passageId: 'b88ba220-0294-4a52-829b-a15630772298',
    expectedVoteDirection: 'VOOR',
    pageRef: '17',
  },

  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-003',
    text: 'Tijdelijke bescherming maakt plek voor wie hier echt mag blijven. We schaffen de asielvergunningen voor onbepaalde tijd af, hiermee worden asielvergunningen tijdelijk. Asielvergunningen voor vluchtelingen krijgen een duur van drie jaar, die voor zogenaamde subsidiair-beschermden één jaar. Na deze periode wordt de vergunning getoetst.',
    summary: 'Asielvergunningen voor onbepaalde tijd afschaffen; vluchtelingen krijgen drie jaar, subsidiair-beschermden één jaar.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: '4f622b2a-4c68-4adb-b823-631107cee733',
    expectedVoteDirection: 'VOOR',
    pageRef: '11',
  },
  {
    promiseCode: 'VVD-2023-004',
    text: 'We voorkomen toekomstige crises met een migratiewet. Die migratiewet zorgt dat het kabinet bij een te hoge instroom van asiel- en/of arbeidsmigranten de bestuursrechtelijke verplichting krijgt zich in te spannen om de instroom te beperken.',
    summary: 'Invoeren van een migratiewet die het kabinet verplicht de instroom te beperken bij te hoge aantallen.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: '077dbc63-8b5d-4e3c-bf2f-2bb4f38a7357',
    expectedVoteDirection: 'VOOR',
    pageRef: '14',
  },
  {
    promiseCode: 'VVD-2023-005',
    text: 'Naturalisatie pas na tien jaar. Het Nederlanderschap is een groot goed. We verlengen de termijn om het Nederlanderschap te verkrijgen naar tien jaar en voor zogenaamde subsidiair-beschermden naar twaalf jaar. We verhogen het vereiste taalniveau voor naturalisatie naar B1.',
    summary: 'Naturalisatietermijn verlengen naar 10 jaar (12 jaar voor subsidiair-beschermden) en taalniveau naar B1.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'cedc5fca-44c1-480d-b761-805e4cfbeab7',
    expectedVoteDirection: 'VOOR',
    pageRef: '16',
  },
  {
    promiseCode: 'VVD-2023-006',
    text: 'Kritischer kijken naar wie we nodig hebben. We moeten kritischer zijn welke arbeidsmigranten (van buiten de EU) onze samenleving wel kan gebruiken en welke niet. Met strengere eisen zorgen we ervoor dat we alleen de voor ons land noodzakelijke arbeidsmigranten naar Nederland laten komen.',
    summary: 'Strengere eisen voor arbeidsmigranten van buiten de EU; alleen toelaten wie Nederland echt nodig heeft.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '6b6c31ac-5fbc-4f55-b882-ce5fb734c8bc',
    expectedVoteDirection: 'VOOR',
    pageRef: '14-15',
  },

  // ── WONEN ─────────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-007',
    text: 'We zetten een mes in procedures en regels. Zo moet het bijvoorbeeld makkelijker worden om microwoningen te bouwen in je achtertuin. Bij kleine bouwprojecten komt er maar weinig stikstof vrij. Wij willen kleine bouwprojecten helpen bij het verkrijgen van vergunningen.',
    summary: 'Snijden in bouwprocedures en regeldruk; stikstofregels versoepelen voor kleine bouwprojecten.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: 'fbcc5874-837a-41fb-83f5-774a38088ff8',
    expectedVoteDirection: 'VOOR',
    pageRef: '51',
  },
  {
    promiseCode: 'VVD-2023-008',
    text: 'We gaan bouwen. De VVD wil dat er overal meer woningen bijkomen. Koopwoningen, middenhuurwoningen en sociale huur. We sluiten een Bouwakkoord. Er komt een plan voor de inrichting van Nederland.',
    summary: 'Woningbouw versnellen met een nationaal Bouwakkoord voor koop-, middenhuur- en sociale huurwoningen.',
    theme: 'WONEN',
    specificity: 'DIRECTIONAL',
    passageId: '0b6e908e-02ac-4ecb-b90f-f91f95b56ce8',
    expectedVoteDirection: 'VOOR',
    pageRef: '50',
  },

  // ── KLIMAAT / ENERGIE ─────────────────────────────────────
  {
    promiseCode: 'VVD-2023-009',
    text: 'We zorgen voor een elektriciteitssector zonder CO₂-uitstoot in 2035. Hierbij zetten we in op tenminste vier grote kerncentrales.',
    summary: 'CO₂-vrije elektriciteitssector in 2035, met inzet op minstens vier grote kerncentrales.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '7945e2e1-0a66-4a69-8cd8-99b798012524',
    expectedVoteDirection: 'VOOR',
    pageRef: '56',
  },
  {
    promiseCode: 'VVD-2023-010',
    text: 'We gaan de energiebelasting verlagen. Om te zorgen dat iedereen de energietransitie kan meemaken verlagen we de belasting op de energierekening.',
    summary: 'Verlaging van de energiebelasting om de energierekening betaalbaar te houden.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: 'ea9259a2-93f9-4e63-b354-a6df133469c7',
    expectedVoteDirection: 'VOOR',
    pageRef: '59',
  },
  {
    promiseCode: 'VVD-2023-011',
    text: 'We stoppen met de gaswinning in Groningen. Daarmee zetten we het beleid dat onder Rutte III is ingezet, door.',
    summary: 'Definitief stoppen met gaswinning in Groningen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '0aaefa01-3a20-484a-b1c1-b56736688241',
    expectedVoteDirection: 'VOOR',
    pageRef: '57',
  },

  // ── VEILIGHEID ────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-012',
    text: 'Verzwaren van de straffen voor grote criminelen. Er komen in beperkte gevallen minimumstraffen voor zware misdrijven. Ook de maximumstraffen voor zware drugsgerelateerde delicten worden fors verhoogd. Daarnaast wordt de verjaringstermijn bij de tenuitvoerlegging van straffen afgeschaft.',
    summary: 'Minimumstraffen voor zware misdrijven invoeren en maximumstraffen voor drugsdelicten fors verhogen.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: 'fe83f2e4-2b0f-4b81-a1c1-d227fd5dc145',
    expectedVoteDirection: 'VOOR',
    pageRef: '22',
  },
  {
    promiseCode: 'VVD-2023-013',
    text: 'Wij blijven investeren in een sterke politie. We willen de Nationale Politie versterken met extra (digitale) wijkagenten, cyberexperts, (specialistische) (wijk)rechercheurs en (specialistische) vrijwilligers. We zorgen dat de politie het beste materieel heeft en passende arbeidsvoorwaarden, en uitgerust wordt met stroomstootwapens en bodycams.',
    summary: 'Nationale Politie versterken met extra wijkagenten, cyberexperts en uitrusting (stroomstootwapens, bodycams).',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: 'fe83f2e4-2b0f-4b81-a1c1-d227fd5dc145',
    expectedVoteDirection: 'VOOR',
    pageRef: '22',
  },

  // ── ECONOMIE ──────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-014',
    text: 'Over de verduurzaming van je eigen huis beslis je zelf. We gaan geen labelsprongen verplichten.',
    summary: 'Geen verplichte labelsprongen voor woningeigenaren; verduurzaming is eigen keuze.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: 'ea9259a2-93f9-4e63-b354-a6df133469c7',
    expectedVoteDirection: 'TEGEN',
    pageRef: '59',
  },

  // ── ZORG ──────────────────────────────────────────────────
  {
    promiseCode: 'VVD-2023-015',
    text: 'We versterken de huisarts. We geven de huisarts meer tijd voor patiënten, en bevorderen dat meer zorg dichtbij huis wordt geboden via huisartsen, wijkverpleging en praktijkondersteuners.',
    summary: 'Meer tijd voor huisartsen per patiënt en versterking eerstelijnszorg dichtbij huis.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '44360411-cc98-438d-83b9-5b108399b094',
    expectedVoteDirection: 'VOOR',
    pageRef: '65',
  },
];

export async function seedVvdPromises(): Promise<void> {
  console.log('[SEED] Starting VVD TK2023 promises seed...');

  try {
    // Look up the VVD 2023 program
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'VVD' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('VVD 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found VVD 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of VVD_PROMISES) {
      // Verify the passage exists
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

    console.log(`[SEED] ✅ VVD TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ VVD promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
