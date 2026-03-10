import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const parliament = await prisma.parliament.findUnique({ where: { slug: "amsterdam" } });
  if (!parliament) return;

  const votes = await prisma.vote.findMany({
    where: { parliamentId: parliament.id, result: "Verworpen" },
    select: { rawData: true },
    take: 15,
  });

  for (const v of votes) {
    const bd = (v.rawData as any)?.voteBreakdown;
    if (bd) {
      console.log(JSON.stringify({
        method: bd.method,
        result: bd.result,
        partiesFor: bd.partiesFor?.length || 0,
        partiesAgainst: bd.partiesAgainst?.length || 0,
        rawText: bd.rawText?.substring(0, 200)
      }));
    }
  }

  // Count with_against verworpen by party data pattern
  const allVerworpen = await prisma.vote.findMany({
    where: { parliamentId: parliament.id, result: "Verworpen" },
    select: { rawData: true },
  });

  let withTegenOnly = 0;
  let withVoorOnly = 0;
  let withBoth = 0;
  let withNeither = 0;

  for (const v of allVerworpen) {
    const bd = (v.rawData as any)?.voteBreakdown;
    if (!bd || bd.method !== "with_against") continue;
    const hasFor = (bd.partiesFor?.length || 0) > 0;
    const hasTegen = (bd.partiesAgainst?.length || 0) > 0;
    if (hasFor && hasTegen) withBoth++;
    else if (hasFor) withVoorOnly++;
    else if (hasTegen) withTegenOnly++;
    else withNeither++;
  }

  console.log(`\nVerworpen with_against patterns:`);
  console.log(`  partiesFor only:    ${withVoorOnly}`);
  console.log(`  partiesAgainst only: ${withTegenOnly}`);
  console.log(`  Both:               ${withBoth}`);
  console.log(`  Neither:            ${withNeither}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
