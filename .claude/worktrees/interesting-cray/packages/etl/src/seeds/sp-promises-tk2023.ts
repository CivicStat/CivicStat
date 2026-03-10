/**
 * Seed SP TK2023 promises extracted from program passages.
 * SP focuses on healthcare (eigen risico), housing (rent control),
 * nationalization, wealth tax, and anti-privatization.
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

const SP_PROMISES: PromiseSeed[] = [
  // ── ZORG ────────────────────────────────────────────────
  {
    promiseCode: 'SP-2023-001',
    text: 'Het eigen risico wordt afgeschaft. Zorg is een recht, geen product. De marktwerking in de zorg wordt teruggedraaid.',
    summary: 'Eigen risico afschaffen en marktwerking in de zorg terugdraaien.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '5b4d79f5-35d8-434d-8df4-d1e91c80d8d5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SP-2023-002',
    text: 'De SP wil een Nationaal Zorgfonds, één publieke zorgverzekeraar zonder winstoogmerk, ter vervanging van de huidige commerciële zorgverzekeraars.',
    summary: 'Nationaal Zorgfonds oprichten als publieke zorgverzekeraar zonder winstoogmerk.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '5b4d79f5-35d8-434d-8df4-d1e91c80d8d5',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── WONEN ───────────────────────────────────────────────
  {
    promiseCode: 'SP-2023-003',
    text: 'De huren gaan omlaag. De SP wil een nationaal bouwplan voor 100.000 betaalbare woningen per jaar, gebouwd door publieke woningcorporaties.',
    summary: 'Huren verlagen; nationaal bouwplan voor 100.000 betaalbare woningen per jaar via woningcorporaties.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '189cccfa-5838-4f5b-89d7-d3287eb63fbd',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SP-2023-004',
    text: 'Speculatie op de woningmarkt wordt aangepakt. Woningcorporaties worden de motor van de volkshuisvesting. Het bezit van meer dan vijf woningen door particuliere beleggers wordt ontmoedigd.',
    summary: 'Speculatie op woningmarkt aanpakken; particuliere beleggers met meer dan vijf woningen ontmoedigen.',
    theme: 'WONEN',
    specificity: 'CONCRETE',
    passageId: '189cccfa-5838-4f5b-89d7-d3287eb63fbd',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ECONOMIE / ARBEID ───────────────────────────────────
  {
    promiseCode: 'SP-2023-005',
    text: 'Het minimumloon gaat naar 16 euro per uur. Iedereen die werkt, moet fatsoenlijk kunnen rondkomen.',
    summary: 'Minimumloon verhogen naar 16 euro per uur.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: 'e81961e0-e8d9-43a3-a277-651eb4df2e94',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SP-2023-006',
    text: 'Er komt een eerlijke verdeling van winst. Werknemers krijgen meer zeggenschap en delen mee in de winst van bedrijven.',
    summary: 'Werknemers meer zeggenschap en winstdeling in bedrijven geven.',
    theme: 'ECONOMIE',
    specificity: 'DIRECTIONAL',
    passageId: '905c5cac-c5eb-4d6b-ae43-d6653d479dc3',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BELASTING / VERMOGEN ────────────────────────────────
  {
    promiseCode: 'SP-2023-007',
    text: 'De SP wil een miljonairsbelasting: een progressieve vermogensbelasting op vermogens boven 1 miljoen euro.',
    summary: 'Miljonairsbelasting invoeren: progressieve vermogensbelasting boven 1 miljoen euro.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '5ebe0355-eaec-4521-8ffd-f1fed4406d51',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SP-2023-008',
    text: 'De btw op boodschappen wordt afgeschaft. De lasten voor lage en middeninkomens gaan omlaag.',
    summary: 'Btw op boodschappen afschaffen en lasten voor lage en middeninkomens verlagen.',
    theme: 'ECONOMIE',
    specificity: 'CONCRETE',
    passageId: '7a4fe3b3-76f4-4824-aecf-37e7b278543d',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── KLIMAAT ─────────────────────────────────────────────
  {
    promiseCode: 'SP-2023-009',
    text: 'De grote vervuilers betalen. De SP wil een eerlijke klimaataanpak waarbij niet de burger maar de industrie de rekening betaalt.',
    summary: 'Eerlijke klimaataanpak: industrie betaalt de rekening, niet de burger.',
    theme: 'KLIMAAT',
    specificity: 'DIRECTIONAL',
    passageId: '6a03acde-f58c-4e03-8194-2f45fc4f0e7f',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SP-2023-010',
    text: 'Energie en water zijn publieke voorzieningen en horen niet in private handen. De SP wil energiebedrijven nationaliseren.',
    summary: 'Energiebedrijven nationaliseren; energie en water als publieke voorzieningen.',
    theme: 'KLIMAAT',
    specificity: 'CONCRETE',
    passageId: '6a03acde-f58c-4e03-8194-2f45fc4f0e7f',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── ONDERWIJS ───────────────────────────────────────────
  {
    promiseCode: 'SP-2023-011',
    text: 'De SP wil meer geld naar het onderwijs: kleinere klassen, hogere lerarensalarissen en minder werkdruk voor docenten.',
    summary: 'Meer investeren in onderwijs: kleinere klassen en hogere lerarensalarissen.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: '80bc8c4f-2cd0-4b32-8dd7-bed134e530e9',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ──────────────────────────────────────────
  {
    promiseCode: 'SP-2023-012',
    text: 'Meer wijkagenten en buurtpreventie. De politie moet zichtbaar aanwezig zijn in de wijk.',
    summary: 'Meer wijkagenten en zichtbare politieaanwezigheid in de wijk.',
    theme: 'VEILIGHEID',
    specificity: 'DIRECTIONAL',
    passageId: 'ce1476d1-657d-44c1-a698-686655fdbf34',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND ──────────────────────────────────────────
  {
    promiseCode: 'SP-2023-013',
    text: 'De SP is kritisch op de EU en wil meer nationale soevereiniteit. Handelsverdragen mogen niet ten koste gaan van arbeidsrechten en milieustandaarden.',
    summary: 'Meer nationale soevereiniteit; handelsverdragen mogen niet ten koste van arbeidsrechten en milieu.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: 'b2cac721-770f-4b14-bce6-e468ddc1232c',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── SOCIAAL ─────────────────────────────────────────────
  {
    promiseCode: 'SP-2023-014',
    text: 'De AOW-leeftijd gaat terug naar 65 jaar voor mensen met zware beroepen.',
    summary: 'AOW-leeftijd terug naar 65 jaar voor mensen met zware beroepen.',
    theme: 'SOCIAAL',
    specificity: 'CONCRETE',
    passageId: 'c4c19b60-6043-478c-b923-fd6add4d559b',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ────────────────────────────────────────────
  {
    promiseCode: 'SP-2023-015',
    text: 'De SP wil een eerlijk en humaan asielbeleid, maar pakt arbeidsmigratie aan door de uitbuiting van arbeidsmigranten te bestrijden.',
    summary: 'Eerlijk asielbeleid met aanpak van uitbuiting van arbeidsmigranten.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: 'd913206b-928d-44fa-8d24-b86835fb5c64',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedSpPromises(): Promise<void> {
  console.log('[SEED] Starting SP TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'SP' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('SP 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found SP 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of SP_PROMISES) {
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

    console.log(`[SEED] ✅ SP TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ SP promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
