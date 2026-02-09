/**
 * Seed GL-PvdA TK2023 promises extracted from program passages.
 * These are the most distinctive, testable GL-PvdA positions from
 * their 2023 election program "Samen voor een hoopvolle toekomst".
 *
 * Extraction criteria (same as VVD):
 * - Distinctive to GL-PvdA (not generic consensus positions)
 * - Testable against parliamentary motions
 * - Cover key themes for contrast with VVD
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

const GLPVDA_PROMISES: PromiseSeed[] = [
  // ── KLIMAAT ───────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-001',
    text: 'In 2030 hebben we als land onze CO2-uitstoot met 65% verminderd (ten opzichte van 1990) en in 2040 zijn we volledig klimaatneutraal. Bovendien zorgen we ervoor dat in 2035 onze elektriciteitsvoorziening CO2-neutraal is, en in 2040 ons gehele energiesysteem.',
    summary: 'CO₂-reductie van 65% in 2030, volledig klimaatneutraal in 2040, CO₂-vrije elektriciteit in 2035.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '7864a29a-adaa-4b70-bf11-ceb64550aaf5',
    expectedVoteDirection: 'VOOR',
    pageRef: '20',
  },
  {
    promiseCode: 'GLPVDA-2023-002',
    text: 'Deze fossiele subsidies schaffen we zo snel mogelijk af. Te beginnen met de vrijstelling van accijns op kerosine binnen Europa, de vrijstelling op het gebruik van kolen en gas voor de opwekking van elektriciteit, de vrijstelling van energiebelasting en kolenbelasting op metallurgische en mineralogische procedés, en de inputvrijstelling van energiebelasting voor de energiesector.',
    summary: 'Zo snel mogelijk afschaffen van alle fossiele subsidies, te beginnen met accijnsvrijstellingen op kerosine en kolen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '4c1b1d80-b129-47c0-964f-53d02cf6a079',
    expectedVoteDirection: 'VOOR',
    pageRef: '28',
  },

  // ── WONEN ─────────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-003',
    text: 'Via een nieuw op te richten Woningbouwfonds zorgen we voor een forse toename in de bouw van betaalbare en duurzame huur- en koopwoningen. De ambitie is dat er jaarlijks 100.000 woningen bijkomen, waarvan minimaal 40.000 sociale huurwoningen en 40.000 woningen in het middensegment (huur en koop).',
    summary: 'Jaarlijks 100.000 nieuwe woningen via Woningbouwfonds: minimaal 40.000 sociaal en 40.000 middensegment.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '5bf68024-9eb4-4435-ba64-f5d1df432bf7',
    expectedVoteDirection: 'VOOR',
    pageRef: '57',
  },
  {
    promiseCode: 'GLPVDA-2023-004',
    text: 'We zien volkshuisvesting nadrukkelijk als een publieke taak. Daarom willen we een minister van Volkshuisvesting en Ruimtelijke Ordening met doorzettingsmacht.',
    summary: 'Volkshuisvesting als publieke taak met een minister van Volkshuisvesting met doorzettingsmacht.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '5bf68024-9eb4-4435-ba64-f5d1df432bf7',
    expectedVoteDirection: 'VOOR',
    pageRef: '57',
  },

  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-005',
    text: 'Wij staan voor de verantwoordelijkheid van onze samenleving om vluchtelingen op te nemen en goed op te vangen. Niet alleen omdat het een juridische afspraak is, maar vooral omdat het een kwestie is van medemenselijkheid die in Nederland breed aanwezig is. Wie onze bescherming nodig heeft tegen oorlog en vervolging, kan bij ons een thuis vinden.',
    summary: 'Vasthouden aan opvangplicht voor vluchtelingen uit medemenselijkheid; wie bescherming nodig heeft vindt een thuis.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '0a4536a1-6d8f-466c-9604-740121b2deef',
    expectedVoteDirection: 'VOOR',
    pageRef: '18',
  },
  {
    promiseCode: 'GLPVDA-2023-006',
    text: 'We zien geen plek meer voor ondernemingen die alleen maar winstgevend kunnen zijn door buitenlandse werknemers uit te buiten. We willen arbeidsmigratie in betere banen leiden. Door het minimumloon te laten stijgen en te stoppen met het subsidiëren van vervuilende bedrijven, stimuleren we bedrijven om te verduurzamen, te innoveren en om normale arbeidsomstandigheden te bieden.',
    summary: 'Arbeidsmigratie reguleren door uitbuiting aan te pakken en minimumloon te verhogen; malafide uitzendbureaus bestrijden.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '5d3e5b6f-b4ad-480f-a9b4-09ea6f7437e4',
    expectedVoteDirection: 'VOOR',
    pageRef: '19',
  },

  // ── ZORG ──────────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-007',
    text: 'We schaffen het eigen risico stapsgewijs af. Het vrijwillig eigen risico verdwijnt helemaal. De nominale zorgpremie wordt verlaagd voor iedereen, zodat we ook de zorgtoeslag kunnen afschaffen.',
    summary: 'Stapsgewijs afschaffen van het eigen risico in de zorg en verlaging van de zorgpremie.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '0fe513f0-8ac4-4e28-b48c-fc16a201f715',
    expectedVoteDirection: 'VOOR',
    pageRef: '66',
  },
  {
    promiseCode: 'GLPVDA-2023-008',
    text: 'Mondzorg, fysiotherapie en andere vormen van noodzakelijke zorg brengen we stapsgewijs terug in het basispakket zodat iedereen daar weer toegang toe heeft.',
    summary: 'Mondzorg en fysiotherapie terug in het basispakket van de zorgverzekering.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '0fe513f0-8ac4-4e28-b48c-fc16a201f715',
    expectedVoteDirection: 'VOOR',
    pageRef: '66',
  },

  // ── ECONOMIE / SOCIAAL ────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-009',
    text: 'Daarom verhogen we het minimumloon naar € 16 per uur (60% van het mediaan brutoloon) en verankeren het minimumloon op 60% van het mediaan loon in de wet, in lijn met de Europese richtlijn. Het minimumloon gaat gelden voor iedereen vanaf achttien jaar.',
    summary: 'Minimumloon verhogen naar €16/uur (60% mediaan) en wettelijk verankeren; geldend vanaf 18 jaar.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: 'aa65f4d5-dd37-4e49-adb6-a7e9682fc21c',
    expectedVoteDirection: 'VOOR',
    pageRef: '32',
  },

  // ── LANDBOUW / NATUUR ─────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-010',
    text: 'Uiterlijk in 2030 is de trend van achteruitgang van de biodiversiteit gekeerd. We houden vast aan het doel om de stikstofuitstoot in 2030 te halveren.',
    summary: 'Stikstofuitstoot halveren in 2030 en biodiversiteitsverlies keren.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '21096fde-7e50-4ce8-a6e3-28b9753076a6',
    expectedVoteDirection: 'VOOR',
    pageRef: '50',
  },
  {
    promiseCode: 'GLPVDA-2023-011',
    text: 'De wolf is welkom in heel Nederland. We handhaven de beschermde status van de wolf en helpen dierenhouders daar waar nodig met het nemen van preventieve maatregelen om eventuele schade door wolven te voorkomen.',
    summary: 'Beschermde status van de wolf handhaven; wolf welkom in heel Nederland.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: '21096fde-7e50-4ce8-a6e3-28b9753076a6',
    expectedVoteDirection: 'VOOR',
    pageRef: '50',
  },

  // ── DEFENSIE / BUITENLAND ─────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-012',
    text: 'De Oekraïners vechten dus ook voor ons en verdienen onze aanhoudende steun. We kunnen niet anders dan de ideeën die ten grondslag liggen aan de Europese Unie - vreedzame samenwerking op basis van overleg en regels - vurig verdedigen.',
    summary: 'Aanhoudende steun aan Oekraïne en vurige verdediging van de Europese rechtsorde.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: '1d049cc9-7595-4e7e-b318-0f949647a42e',
    expectedVoteDirection: 'VOOR',
    pageRef: '15',
  },

  // ── VEILIGHEID ────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-013',
    text: 'Al op jonge leeftijd worden jongeren met weinig bestaanszekerheid en toekomstperspectief geronseld voor kleine klusjes. Wij vinden dat we als samenleving deze jongeren niet aan hun lot mogen overlaten. Binnen het Nationaal Programma Leefbaarheid en Veiligheid geven we extra aandacht aan het onderdeel Preventie met Gezag.',
    summary: 'Preventieve aanpak van jeugdcriminaliteit via Preventie met Gezag: perspectief bieden in plaats van alleen straffen.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: '8ec354be-8e1d-4a6f-b9ff-689c7f063748',
    expectedVoteDirection: 'VOOR',
    pageRef: '72',
  },

  // ── ONDERWIJS ─────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-014',
    text: 'Stapsgewijs zorgen we ervoor dat alle kinderen alle dagen van de werkweek gratis naar de kinderopvang en de bso kunnen. In de tussentijd zorgen we er met een prijsplafond voor dat kinderopvang voor iedereen toegankelijk is.',
    summary: 'Gratis kinderopvang als publieke basisvoorziening voor alle kinderen, met prijsplafond in de tussentijd.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '40f38dee-c48c-4b7b-aa97-9df7b6fef5dc',
    expectedVoteDirection: 'VOOR',
    pageRef: '60',
  },

  // ── BESTUUR ───────────────────────────────────────────────
  {
    promiseCode: 'GLPVDA-2023-015',
    text: 'Gelote burgerberaden en wijkstemdagen zijn goede instrumenten om tot beter beleid te komen. Wij steunen het burgerberaad als een waardevol democratisch instrument.',
    summary: 'Borgen van het burgerberaad als democratisch instituut; ondersteuning van gelote burgerberaden.',
    theme: 'BESTUUR',
    specificity: 'DIRECTIONAL',
    passageId: 'b495991d-54e4-4435-99c5-76f52fae4521',
    expectedVoteDirection: 'VOOR',
    pageRef: '42',
  },
];

export async function seedGlpvdaPromises(): Promise<void> {
  console.log('[SEED] Starting GL-PvdA TK2023 promises seed...');

  try {
    // Look up the GL-PvdA 2023 program
    const program = await prisma.program.findFirst({
      where: {
        party: {
          OR: [
            { abbreviation: 'GL-PvdA' },
            { abbreviation: 'GroenLinks-PvdA' },
            { name: { contains: 'GroenLinks', mode: 'insensitive' } },
          ],
        },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('GL-PvdA 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found GL-PvdA 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of GLPVDA_PROMISES) {
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

    console.log(`[SEED] ✅ GL-PvdA TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ GL-PvdA promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
