/**
 * CivicStat Data Quality Audit
 * Run: npx tsx src/scripts/data-audit.ts
 * Produces JSON audit results to stdout
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function audit() {
  const results: Record<string, any> = {};

  // ═══════════════════════════════════════════════════════════
  // 1. Parliament overview
  // ═══════════════════════════════════════════════════════════
  const parliaments = await prisma.parliament.findMany({
    select: {
      id: true, slug: true, shortName: true, level: true, seats: true,
      _count: { select: { parties: true, mps: true, motions: true, votes: true } },
    },
  });
  results.parliaments = parliaments.map(p => ({
    slug: p.slug, name: p.shortName, level: p.level, seats: p.seats,
    parties: p._count.parties, mps: p._count.mps,
    motions: p._count.motions, votes: p._count.votes,
  }));

  // ═══════════════════════════════════════════════════════════
  // 2. Municipal parties — abbreviation coverage for TK alias map
  // ═══════════════════════════════════════════════════════════
  const MUNICIPAL_TO_TK: Record<string, string> = {
    "GroenLinks": "GroenLinks-PvdA",
    "PvdA": "GroenLinks-PvdA",
    "Partij voor de Dieren": "PvdD",
    "VOLT": "Volt",
    "FVD": "FVD",
    "ChristenUnie-SGP": "ChristenUnie",
  };

  const tkParties = await prisma.party.findMany({
    where: { parliament: { level: "NATIONAL" } },
    select: { abbreviation: true },
  });
  const tkAbbreviations = new Set(tkParties.map(p => p.abbreviation.toLowerCase()));

  const municipalParties = await prisma.party.findMany({
    where: { parliament: { level: "MUNICIPAL" } },
    select: { abbreviation: true, parliament: { select: { shortName: true } } },
  });

  const aliasMap: Record<string, { matched: boolean; via: string; municipalities: string[] }> = {};
  for (const mp of municipalParties) {
    const abbr = mp.abbreviation;
    if (!aliasMap[abbr]) {
      const directMatch = tkAbbreviations.has(abbr.toLowerCase());
      const aliasMatch = MUNICIPAL_TO_TK[abbr]
        ? tkAbbreviations.has(MUNICIPAL_TO_TK[abbr].toLowerCase())
        : false;
      aliasMap[abbr] = {
        matched: directMatch || aliasMatch,
        via: directMatch ? "direct" : aliasMatch ? `alias→${MUNICIPAL_TO_TK[abbr]}` : "none",
        municipalities: [],
      };
    }
    aliasMap[abbr].municipalities.push(mp.parliament!.shortName);
  }

  const unmatchedParties = Object.entries(aliasMap)
    .filter(([, v]) => !v.matched)
    .map(([k, v]) => ({ abbreviation: k, municipalities: v.municipalities }));
  const matchedParties = Object.entries(aliasMap)
    .filter(([, v]) => v.matched)
    .map(([k, v]) => ({ abbreviation: k, via: v.via, municipalities: v.municipalities }));

  results.aliasMapCoverage = {
    totalUniqueMunicipalParties: Object.keys(aliasMap).length,
    matched: matchedParties.length,
    unmatched: unmatchedParties.length,
    matchRate: `${((matchedParties.length / Object.keys(aliasMap).length) * 100).toFixed(1)}%`,
    matchedDetails: matchedParties,
    unmatchedDetails: unmatchedParties,
  };

  // ═══════════════════════════════════════════════════════════
  // 3. Promise counts per parliament + party
  // ═══════════════════════════════════════════════════════════
  const promiseCounts = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    parliament_name: string;
    party_abbreviation: string;
    promise_count: bigint;
    themes: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      parl.short_name AS parliament_name,
      p.abbreviation AS party_abbreviation,
      COUNT(pr.id) AS promise_count,
      COUNT(DISTINCT pr.theme) AS themes
    FROM promises pr
    JOIN programs ep ON pr.program_id = ep.id
    JOIN parties p ON ep.party_id = p.id
    JOIN parliaments parl ON p.parliament_id = parl.id
    GROUP BY parl.slug, parl.short_name, p.abbreviation
    ORDER BY parl.slug, promise_count DESC
  `;

  results.promiseCounts = promiseCounts.map(r => ({
    parliament: r.parliament_slug,
    party: r.party_abbreviation,
    promises: Number(r.promise_count),
    uniqueThemes: Number(r.themes),
  }));

  // ═══════════════════════════════════════════════════════════
  // 4. PrecomputedScorecard validation
  // ═══════════════════════════════════════════════════════════
  const scorecards = await prisma.precomputedScorecard.findMany({
    include: { party: { select: { abbreviation: true } }, parliament: { select: { slug: true } } },
  });

  const scorecardIssues: string[] = [];
  const scorecardSummary: Array<Record<string, any>> = [];

  for (const sc of scorecards) {
    const detail = sc.detailJson as any;
    const detailMcs = detail?.mandateConsistencyScore ?? null;
    const mcsMatch = detailMcs === null || Math.abs(detailMcs - sc.mcs) < 0.01;

    if (!mcsMatch) {
      scorecardIssues.push(
        `${sc.party.abbreviation} (${sc.parliament?.slug ?? "null"}): DB mcs=${sc.mcs}, detailJson mcs=${detailMcs}`
      );
    }
    if (sc.totalPromises === 0) {
      scorecardIssues.push(`${sc.party.abbreviation}: totalPromises is 0`);
    }
    if (sc.mcs === 0 && sc.scoredPromises > 0) {
      scorecardIssues.push(`${sc.party.abbreviation}: mcs=0 but scoredPromises=${sc.scoredPromises}`);
    }
    if (sc.parliamentId === null) {
      scorecardIssues.push(`${sc.party.abbreviation}: parliamentId is NULL`);
    }

    scorecardSummary.push({
      parliament: sc.parliament?.slug ?? null,
      party: sc.party.abbreviation,
      year: sc.electionYear,
      mcs: sc.mcs,
      totalPromises: sc.totalPromises,
      scoredPromises: sc.scoredPromises,
      consistent: sc.consistentCount,
      inconsistent: sc.inconsistentCount,
      mixed: sc.mixedCount,
      detailHasMcs: detailMcs !== null,
      detailMcs,
      mcsMatch,
    });
  }

  results.scorecards = {
    total: scorecards.length,
    issues: scorecardIssues,
    issueCount: scorecardIssues.length,
    details: scorecardSummary,
  };

  // ═══════════════════════════════════════════════════════════
  // 5. Theme distribution across promises
  // ═══════════════════════════════════════════════════════════
  const themeDistribution = await prisma.$queryRaw<Array<{
    theme: string;
    count: bigint;
    parliament_slug: string;
  }>>`
    SELECT
      pr.theme,
      COUNT(*) AS count,
      parl.slug AS parliament_slug
    FROM promises pr
    JOIN programs ep ON pr.program_id = ep.id
    JOIN parties p ON ep.party_id = p.id
    JOIN parliaments parl ON p.parliament_id = parl.id
    GROUP BY pr.theme, parl.slug
    ORDER BY parl.slug, count DESC
  `;

  results.themeDistribution = themeDistribution.map(r => ({
    theme: r.theme,
    count: Number(r.count),
    parliament: r.parliament_slug,
  }));

  // ═══════════════════════════════════════════════════════════
  // 6. Promise-Motion match quality
  // ═══════════════════════════════════════════════════════════
  const matchStats = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    match_type: string;
    match_method: string | null;
    count: bigint;
    avg_confidence: number;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      pmm.match_type,
      pmm.match_method,
      COUNT(*) AS count,
      AVG(pmm.confidence) AS avg_confidence
    FROM promise_motion_matches pmm
    JOIN promises pr ON pmm.promise_id = pr.id
    JOIN programs ep ON pr.program_id = ep.id
    JOIN parties p ON ep.party_id = p.id
    JOIN parliaments parl ON p.parliament_id = parl.id
    GROUP BY parl.slug, pmm.match_type, pmm.match_method
    ORDER BY parl.slug, count DESC
  `;

  results.matchQuality = matchStats.map(r => ({
    parliament: r.parliament_slug,
    matchType: r.match_type,
    matchMethod: r.match_method,
    count: Number(r.count),
    avgConfidence: r.avg_confidence ? Number(Number(r.avg_confidence).toFixed(3)) : null,
  }));

  // Promises without any matches
  const unmatchedPromises = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    total_promises: bigint;
    matched_promises: bigint;
    unmatched_promises: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      COUNT(DISTINCT pr.id) AS total_promises,
      COUNT(DISTINCT pmm.promise_id) AS matched_promises,
      COUNT(DISTINCT pr.id) - COUNT(DISTINCT pmm.promise_id) AS unmatched_promises
    FROM promises pr
    JOIN programs ep ON pr.program_id = ep.id
    JOIN parties p ON ep.party_id = p.id
    JOIN parliaments parl ON p.parliament_id = parl.id
    LEFT JOIN promise_motion_matches pmm ON pmm.promise_id = pr.id
    GROUP BY parl.slug
  `;

  results.promiseMatchCoverage = unmatchedPromises.map(r => ({
    parliament: r.parliament_slug,
    totalPromises: Number(r.total_promises),
    matchedPromises: Number(r.matched_promises),
    unmatchedPromises: Number(r.unmatched_promises),
    matchRate: `${((Number(r.matched_promises) / Number(r.total_promises)) * 100).toFixed(1)}%`,
  }));

  // ═══════════════════════════════════════════════════════════
  // 7. VoteRecord coverage
  // ═══════════════════════════════════════════════════════════
  const voteRecordCoverage = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    total_votes: bigint;
    votes_with_records: bigint;
    total_records: bigint;
    avg_records_per_vote: number;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      COUNT(DISTINCT v.id) AS total_votes,
      COUNT(DISTINCT vr.vote_id) AS votes_with_records,
      COUNT(vr.id) AS total_records,
      CASE WHEN COUNT(DISTINCT vr.vote_id) > 0
        THEN ROUND(COUNT(vr.id)::numeric / COUNT(DISTINCT vr.vote_id), 1)
        ELSE 0
      END AS avg_records_per_vote
    FROM votes v
    JOIN parliaments parl ON v.parliament_id = parl.id
    LEFT JOIN vote_records vr ON vr.vote_id = v.id
    GROUP BY parl.slug
  `;

  results.voteRecordCoverage = voteRecordCoverage.map(r => ({
    parliament: r.parliament_slug,
    totalVotes: Number(r.total_votes),
    votesWithRecords: Number(r.votes_with_records),
    votesWithoutRecords: Number(r.total_votes) - Number(r.votes_with_records),
    totalRecords: Number(r.total_records),
    avgRecordsPerVote: Number(r.avg_records_per_vote),
    coverage: `${((Number(r.votes_with_records) / Number(r.total_votes)) * 100).toFixed(1)}%`,
  }));

  // VoteRecord value distribution
  const voteValueDist = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    vote_value: string;
    count: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      vr.vote_value,
      COUNT(*) AS count
    FROM vote_records vr
    JOIN votes v ON vr.vote_id = v.id
    JOIN parliaments parl ON v.parliament_id = parl.id
    GROUP BY parl.slug, vr.vote_value
    ORDER BY parl.slug, count DESC
  `;

  results.voteValueDistribution = voteValueDist.map(r => ({
    parliament: r.parliament_slug,
    voteValue: r.vote_value,
    count: Number(r.count),
  }));

  // ═══════════════════════════════════════════════════════════
  // 8. Motions without votes
  // ═══════════════════════════════════════════════════════════
  const motionsWithoutVotes = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    total_motions: bigint;
    motions_with_votes: bigint;
    motions_without_votes: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      COUNT(DISTINCT m.id) AS total_motions,
      COUNT(DISTINCT v.motion_id) AS motions_with_votes,
      COUNT(DISTINCT m.id) - COUNT(DISTINCT v.motion_id) AS motions_without_votes
    FROM motions m
    JOIN parliaments parl ON m.parliament_id = parl.id
    LEFT JOIN votes v ON v.motion_id = m.id
    GROUP BY parl.slug
  `;

  results.motionVoteCoverage = motionsWithoutVotes.map(r => ({
    parliament: r.parliament_slug,
    totalMotions: Number(r.total_motions),
    motionsWithVotes: Number(r.motions_with_votes),
    motionsWithoutVotes: Number(r.motions_without_votes),
    coverage: `${((Number(r.motions_with_votes) / Number(r.total_motions)) * 100).toFixed(1)}%`,
  }));

  // ═══════════════════════════════════════════════════════════
  // 9. PartyBranch table status
  // ═══════════════════════════════════════════════════════════
  const branchCount = await prisma.partyBranch.count();
  results.partyBranch = { totalRecords: branchCount };

  // ═══════════════════════════════════════════════════════════
  // 10. Motion type (soort) distribution
  // ═══════════════════════════════════════════════════════════
  const motionTypes = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    soort: string | null;
    count: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      m.soort,
      COUNT(*) AS count
    FROM motions m
    JOIN parliaments parl ON m.parliament_id = parl.id
    GROUP BY parl.slug, m.soort
    ORDER BY parl.slug, count DESC
  `;

  results.motionTypes = motionTypes.map(r => ({
    parliament: r.parliament_slug,
    soort: r.soort ?? "NULL",
    count: Number(r.count),
  }));

  // ═══════════════════════════════════════════════════════════
  // 11. Scorecard detail: per-promise match scoring coverage
  // ═══════════════════════════════════════════════════════════
  const promiseMatchDistribution = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    specificity: string;
    count: bigint;
    avg_matches: number;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      pr.specificity,
      COUNT(pr.id) AS count,
      ROUND(AVG(sub.match_count), 2) AS avg_matches
    FROM promises pr
    JOIN programs ep ON pr.program_id = ep.id
    JOIN parties p ON ep.party_id = p.id
    JOIN parliaments parl ON p.parliament_id = parl.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS match_count
      FROM promise_motion_matches pmm
      WHERE pmm.promise_id = pr.id
    ) sub ON true
    GROUP BY parl.slug, pr.specificity
    ORDER BY parl.slug, count DESC
  `;

  results.promiseSpecificity = promiseMatchDistribution.map(r => ({
    parliament: r.parliament_slug,
    specificity: r.specificity,
    count: Number(r.count),
    avgMatches: Number(r.avg_matches),
  }));

  // ═══════════════════════════════════════════════════════════
  // 12. Municipal vote parsing quality (FOR/AGAINST distribution)
  // ═══════════════════════════════════════════════════════════
  const municipalVoteResults = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    result: string | null;
    count: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      v.result,
      COUNT(*) AS count
    FROM votes v
    JOIN parliaments parl ON v.parliament_id = parl.id
    WHERE parl.level = 'MUNICIPAL'
    GROUP BY parl.slug, v.result
    ORDER BY parl.slug, count DESC
  `;

  results.municipalVoteResults = municipalVoteResults.map(r => ({
    parliament: r.parliament_slug,
    result: r.result ?? "NULL",
    count: Number(r.count),
  }));

  // Municipal votes with zero for+against (unresolved parsing)
  const zeroCounts = await prisma.$queryRaw<Array<{
    parliament_slug: string;
    zero_count: bigint;
    total_count: bigint;
  }>>`
    SELECT
      parl.slug AS parliament_slug,
      COUNT(*) FILTER (WHERE v.total_for = 0 AND v.total_against = 0) AS zero_count,
      COUNT(*) AS total_count
    FROM votes v
    JOIN parliaments parl ON v.parliament_id = parl.id
    WHERE parl.level = 'MUNICIPAL'
    GROUP BY parl.slug
  `;

  results.municipalZeroVoteCounts = zeroCounts.map(r => ({
    parliament: r.parliament_slug,
    zeroForAndAgainst: Number(r.zero_count),
    totalVotes: Number(r.total_count),
    pctZero: `${((Number(r.zero_count) / Number(r.total_count)) * 100).toFixed(1)}%`,
  }));

  // Output
  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
