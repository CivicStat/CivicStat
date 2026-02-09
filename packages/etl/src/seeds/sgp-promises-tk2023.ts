/**
 * Seed SGP TK2023 promises extracted from program passages.
 * SGP focuses on Christian values, pro-life, pro-Israel, traditional family,
 * Sunday rest, religious freedom, pro-farmers, and conservative drug policy.
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

const SGP_PROMISES: PromiseSeed[] = [
  // ── ZORG / ETHIEK ─────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-001',
    text: 'Het menselijk leven is een kostbaar geschenk van de Schepper. De SGP wil geen verdere verruiming van de euthanasiewet en verzet zich tegen voltooid-levenwetgeving.',
    summary: 'Geen verruiming euthanasiewet; tegen voltooid-levenwetgeving.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: 'd348e797-67e1-411c-a04b-f07de8966288',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-002',
    text: 'De SGP wil goede gezondheidszorg die kwetsbaar leven beschermt. Geen verruiming van abortus; de termijn mag niet worden verlengd.',
    summary: 'Geen verruiming abortuswetgeving; bescherming ongeboren leven.',
    theme: 'ZORG',
    specificity: 'CONCRETE',
    passageId: '2e970849-0670-4263-ab95-d74d0d647501',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-003',
    text: 'De thuiszorg moet worden versterkt. Ouderen verdienen liefdevolle zorg en moeten zo lang mogelijk thuis kunnen blijven wonen met goede ondersteuning.',
    summary: 'Thuiszorg versterken; ouderen langer thuis laten wonen met goede zorg.',
    theme: 'ZORG',
    specificity: 'DIRECTIONAL',
    passageId: '8107b3bb-24b0-4b7e-b9da-a7482e832189',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── GEZIN EN ONDERWIJS ────────────────────────────────────
  {
    promiseCode: 'SGP-2023-004',
    text: 'Er komt een ministerie van jeugd- en gezinsbeleid. Relatietherapie wordt vergoed. De SGP wil keuzevrijheid voor gezinnen in opvoeding en onderwijs.',
    summary: 'Ministerie van jeugd- en gezinsbeleid; keuzevrijheid voor gezinnen.',
    theme: 'ONDERWIJS',
    specificity: 'CONCRETE',
    passageId: '36b6fb6b-7dcd-4d60-8cfa-79402b0d87da',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-005',
    text: 'Recht doen aan het onderwijs. De SGP wil vrijheid van onderwijs beschermen, het bijzonder onderwijs in stand houden en ouders keuzevrijheid geven.',
    summary: 'Vrijheid van onderwijs beschermen; bijzonder onderwijs behouden.',
    theme: 'ONDERWIJS',
    specificity: 'DIRECTIONAL',
    passageId: 'ca9a6bcf-e5ac-4f14-9a90-10dac775e129',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── SOCIAAL / BESTAANSZEKERHEID ───────────────────────────
  {
    promiseCode: 'SGP-2023-006',
    text: 'Er moet werk worden gemaakt van een fatsoenlijk bestaansminimum. De basis moet op orde: armoede en schulden moeten worden bestreden.',
    summary: 'Fatsoenlijk bestaansminimum; armoede en schulden bestrijden.',
    theme: 'SOCIAAL',
    specificity: 'DIRECTIONAL',
    passageId: '88995fea-e85e-40b1-ac62-9b7794a2d4c6',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── LANDBOUW ──────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-007',
    text: 'De stikstofimpasse kan alleen doorbroken worden als er een andere aanpak komt. Niet meer door eenzijdig te mikken op inkrimping van de veestapel.',
    summary: 'Andere stikstofaanpak: niet eenzijdig inkrimpen veestapel.',
    theme: 'LANDBOUW',
    specificity: 'DIRECTIONAL',
    passageId: '14474aab-2da7-48e8-9246-28bf3b26bb99',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-008',
    text: 'De SGP wil samenwerken met boeren en tuinders. Een fiscale investeringsreserve voor het opvangen van oogstschade door weersextremen.',
    summary: 'Samenwerken met boeren; fiscale investeringsreserve voor oogstschade.',
    theme: 'LANDBOUW',
    specificity: 'CONCRETE',
    passageId: 'c8190c51-fb2e-4a23-a35c-162757c50975',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── VEILIGHEID ────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-009',
    text: '500 extra agenten op straat. In ieder dorp een politiepost. Strenger straffen en een drugsvrije samenleving nastreven.',
    summary: '500 extra agenten; strenger straffen; drugsvrije samenleving.',
    theme: 'VEILIGHEID',
    specificity: 'CONCRETE',
    passageId: 'fc5f9a6a-96f8-4196-bd08-9fba3b10b5ff',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── DEFENSIE ──────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-010',
    text: 'Na de Russische inval in Oekraïne beseften we weer dat vrede nooit vanzelfsprekend is. De SGP wil een robuuste krijgsmacht met voldoende budget.',
    summary: 'Robuuste krijgsmacht met voldoende defensiebudget.',
    theme: 'DEFENSIE',
    specificity: 'DIRECTIONAL',
    passageId: '90a16547-3bce-4119-9376-fa68b3090488',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── MIGRATIE ──────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-011',
    text: 'De grens is nu echt bereikt. Er komen te veel migranten naar Nederland. De SGP wil invoering van een migratiequotum: een bovengrens aan migratie.',
    summary: 'Bovengrens aan migratie invoeren via een migratiequotum.',
    theme: 'MIGRATIE',
    specificity: 'CONCRETE',
    passageId: 'fc8e1dc0-3451-4ca7-8e5f-db15f5e08c01',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-012',
    text: 'Van nieuwkomers mag verwacht worden dat ze zich aanpassen en zo snel mogelijk Nederlands leren. Een menswaardig en realistisch asielbeleid.',
    summary: 'Nieuwkomers moeten zich aanpassen; menswaardig maar realistisch asielbeleid.',
    theme: 'MIGRATIE',
    specificity: 'DIRECTIONAL',
    passageId: '36f66734-3bf1-41ec-847b-9a904790759e',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BUITENLAND ────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-013',
    text: 'Christenen hebben wereldwijd het meest te lijden onder vervolgingen. De SGP wil dat Nederland zich internationaal inzet tegen christenvervolging.',
    summary: 'Internationale inzet tegen christenvervolging.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: '2f2a232a-be01-469b-bd12-5dc0201dfa74',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
  {
    promiseCode: 'SGP-2023-014',
    text: 'De SGP staat voor de strijd tegen antisemitisme en steunt de staat Israël als bondgenoot.',
    summary: 'Bestrijding antisemitisme; steun voor de staat Israël.',
    theme: 'BUITENLAND',
    specificity: 'DIRECTIONAL',
    passageId: '87b0d553-30ae-4fe6-be48-07857897d544',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },

  // ── BESTUUR ───────────────────────────────────────────────
  {
    promiseCode: 'SGP-2023-015',
    text: 'In de Europese Unie moet realisme uitgangspunt zijn. Geen verdere uitbreiding EU-bevoegdheden. De SGP wil acceptatieplicht voor contant geld.',
    summary: 'Geen verdere EU-bevoegdheden; acceptatieplicht contant geld.',
    theme: 'BESTUUR',
    specificity: 'CONCRETE',
    passageId: 'c4c23f00-948e-4b82-a480-2541aeaf9d41',
    expectedVoteDirection: 'VOOR',
    pageRef: null,
  },
];

export async function seedSgpPromises(): Promise<void> {
  console.log('[SEED] Starting SGP TK2023 promises seed...');

  try {
    const program = await prisma.program.findFirst({
      where: {
        party: { abbreviation: 'SGP' },
        electionYear: 2023,
      },
    });

    if (!program) {
      throw new Error('SGP 2023 program not found. Run program ingest first.');
    }

    console.log(`[SEED] Found SGP 2023 program: ${program.id}`);

    let upserted = 0;

    for (const promise of SGP_PROMISES) {
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

    console.log(`[SEED] ✅ SGP TK2023 promises seed complete: ${upserted} promises upserted`);
  } catch (error) {
    console.error('[SEED] ❌ SGP promises seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
