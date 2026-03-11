import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { prisma } from "@ntp/db";
import { COALITIONS, getCoalitionBySlug } from "./coalitions.config";
import { CoalitionDynamicsService } from "./coalition-dynamics.service";
import { PartiesScorecardService } from "../parties/parties-scorecard.service";

@ApiTags("coalitions")
@Controller("coalitions")
export class CoalitionsController {
  constructor(
    private readonly coalitionDynamicsService: CoalitionDynamicsService,
    private readonly scorecardService: PartiesScorecardService,
  ) {}

  /**
   * GET /coalitions — list all known coalition configurations.
   */
  @ApiOperation({ summary: "List all coalition configurations", description: "Returns all tracked coalitions with their member parties and active periods." })
  @Get()
  listCoalitions() {
    return COALITIONS.map((c) => ({
      name: c.name,
      slug: c.slug,
      parties: c.parties,
      startDate: c.startDate,
      endDate: c.endDate,
      active: c.endDate === null,
    }));
  }

  /**
   * GET /coalitions/compare — Compare coalition dynamics across all coalitions.
   * Returns CAI, classification, and coalitieverwatering for each coalition.
   */
  @ApiOperation({ summary: "Compare coalition dynamics across all coalitions", description: "Returns CAI, vote classification, and coalitieverwatering for each tracked coalition." })
  @Get("compare")
  async compareCoalitions() {
    const results = await Promise.all(
      COALITIONS.map(async (c) => {
        const [alignment, classification] = await Promise.all([
          this.coalitionDynamicsService.computeCAI(c.slug),
          this.coalitionDynamicsService.classifyVotes(c.slug),
        ]);

        // CAI stats for coalition members only
        const memberAlignment = alignment.filter((a) => a.isCoalitionMember);
        const avgMemberCAI =
          memberAlignment.length > 0
            ? Math.round(
                memberAlignment.reduce((sum, a) => sum + a.cai, 0) /
                  memberAlignment.length,
              )
            : 0;

        // Coalitieverwatering: % of free votes where coalition parties split
        const coalitionPct =
          classification.totalVotes > 0
            ? Math.round(
                (classification.coalitionVotes / classification.totalVotes) *
                  100,
              )
            : 0;
        const freePct =
          classification.totalVotes > 0
            ? Math.round(
                (classification.freeVotes / classification.totalVotes) * 100,
              )
            : 0;

        return {
          coalition: {
            name: c.name,
            slug: c.slug,
            parties: c.parties,
            startDate: c.startDate,
            endDate: c.endDate,
            active: c.endDate === null,
          },
          classification: {
            totalVotes: classification.totalVotes,
            coalitionVotes: classification.coalitionVotes,
            freeVotes: classification.freeVotes,
            noDataVotes: classification.noDataVotes,
            coalitionPct,
            freePct,
          },
          alignment: {
            avgMemberCAI,
            parties: alignment.map((a) => ({
              abbreviation: a.abbreviation,
              cai: a.cai,
              totalVotesAnalyzed: a.totalVotesAnalyzed,
              isCoalitionMember: a.isCoalitionMember,
            })),
          },
          coalitieverwatering: freePct,
        };
      }),
    );

    return results;
  }

  /**
   * GET /coalitions/:slug/alignment — CAI for all tracked parties
   * during this coalition's active period.
   */
  @ApiOperation({ summary: "Coalition Alignment Index for all parties", description: "Returns CAI scores showing how aligned each party is with coalition voting behavior." })
  @ApiParam({ name: "slug", description: "Coalition slug (e.g. schoof, jetten)" })
  @Get(":slug/alignment")
  async getAlignment(@Param("slug") slug: string) {
    return this.coalitionDynamicsService.computeCAI(slug);
  }

  /**
   * GET /coalitions/:slug/classification — Vote classification summary.
   * Returns how many votes were coalition-unanimous vs. free votes.
   */
  @ApiOperation({ summary: "Vote classification for a coalition", description: "Returns how many votes were coalition-unanimous (coalition votes) vs. free votes where parties split." })
  @ApiParam({ name: "slug", description: "Coalition slug" })
  @Get(":slug/classification")
  async getClassification(@Param("slug") slug: string) {
    const result = await this.coalitionDynamicsService.classifyVotes(slug);
    return {
      coalitionName: result.coalitionName,
      coalitionSlug: result.coalitionSlug,
      totalVotes: result.totalVotes,
      coalitionVotes: result.coalitionVotes,
      freeVotes: result.freeVotes,
      noDataVotes: result.noDataVotes,
      coalitionPct: result.totalVotes > 0
        ? Math.round((result.coalitionVotes / result.totalVotes) * 100)
        : 0,
      freePct: result.totalVotes > 0
        ? Math.round((result.freeVotes / result.totalVotes) * 100)
        : 0,
    };
  }

  /**
   * GET /coalitions/:slug/belofte-o-meter — Coalition agreement promise tracker.
   * Returns all regeerakkoord promises with per-party voting status,
   * aggregated by theme for thermometer visualisation.
   */
  @ApiOperation({
    summary: "Belofte-O-Meter for a coalition",
    description: "Returns regeerakkoord promises with per-party consistency status, aggregated by theme. Shows which coalition agreement promises have been acted on in parliament.",
  })
  @ApiParam({ name: "slug", description: "Coalition slug (e.g. schoof, jetten)" })
  @Get(":slug/belofte-o-meter")
  async getBelofteOMeter(@Param("slug") slug: string) {
    const coalition = getCoalitionBySlug(slug);
    if (!coalition) {
      throw new NotFoundException(`Coalition '${slug}' not found`);
    }

    const year = slug === "jetten" ? 2026 : 2024;

    // Look up the regeerakkoord program to get correct party UUIDs
    // (avoids findFirst ambiguity with duplicate party abbreviations across parliaments)
    const program = await prisma.program.findFirst({
      where: { programType: "REGEERAKKOORD", electionYear: year },
    });
    if (!program || program.coalitionPartyIds.length === 0) {
      throw new NotFoundException(
        `Geen regeerakkoord gevonden voor ${coalition.name}`,
      );
    }

    // Fetch regeerakkoord scorecards using the exact party UUIDs from the program
    const partyScorecards = await Promise.all(
      program.coalitionPartyIds.map(async (partyId) => {
        try {
          return await this.scorecardService.getRegeerakkoordScorecard(partyId, {
            electionYear: year,
          });
        } catch {
          return null;
        }
      }),
    );

    const validScorecards = partyScorecards.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    );

    if (validScorecards.length === 0) {
      throw new NotFoundException(
        `Geen regeerakkoord-gegevens gevonden voor ${coalition.name}`,
      );
    }

    // Use first scorecard as the canonical promise list (all parties share the same regeerakkoord promises)
    const canonical = validScorecards[0];

    // Build per-promise detail with per-party status
    const promiseDetails = canonical.promises.map((promise) => {
      const partyStatuses: Record<
        string,
        { status: string; alignedVotes: number; opposedVotes: number }
      > = {};
      for (const sc of validScorecards) {
        const p = sc.promises.find((pp) => pp.promiseId === promise.promiseId);
        if (p) {
          partyStatuses[sc.abbreviation] = {
            status: p.status,
            alignedVotes: p.alignedVotes,
            opposedVotes: p.opposedVotes,
          };
        }
      }

      // Aggregate: promise is "enacted" if majority of coalition parties are consistent,
      // "broken" if majority are inconsistent, "pending" otherwise
      const statuses = Object.values(partyStatuses).map((s) => s.status);
      const consistentN = statuses.filter((s) => s === "consistent").length;
      const inconsistentN = statuses.filter((s) => s === "inconsistent").length;
      const majority = Math.ceil(validScorecards.length / 2);

      let coalitionStatus: "enacted" | "broken" | "pending" | "insufficient_data";
      if (consistentN >= majority) coalitionStatus = "enacted";
      else if (inconsistentN >= majority) coalitionStatus = "broken";
      else if (statuses.every((s) => s === "insufficient_data"))
        coalitionStatus = "insufficient_data";
      else coalitionStatus = "pending";

      return {
        promiseId: promise.promiseId,
        promiseCode: promise.promiseCode,
        summary: promise.summary,
        theme: promise.theme,
        coalitionStatus,
        partyStatuses,
      };
    });

    // Aggregate by theme
    const themes: Record<
      string,
      { total: number; enacted: number; broken: number; pending: number; insufficientData: number }
    > = {};

    for (const p of promiseDetails) {
      if (!themes[p.theme]) {
        themes[p.theme] = { total: 0, enacted: 0, broken: 0, pending: 0, insufficientData: 0 };
      }
      themes[p.theme].total++;
      if (p.coalitionStatus === "enacted") themes[p.theme].enacted++;
      else if (p.coalitionStatus === "broken") themes[p.theme].broken++;
      else if (p.coalitionStatus === "pending") themes[p.theme].pending++;
      else themes[p.theme].insufficientData++;
    }

    // Overall stats
    const totalPromises = promiseDetails.length;
    const enacted = promiseDetails.filter((p) => p.coalitionStatus === "enacted").length;
    const broken = promiseDetails.filter((p) => p.coalitionStatus === "broken").length;
    const pending = promiseDetails.filter((p) => p.coalitionStatus === "pending").length;
    const insufficientData = promiseDetails.filter(
      (p) => p.coalitionStatus === "insufficient_data",
    ).length;

    return {
      coalition: {
        name: coalition.name,
        slug: coalition.slug,
        parties: coalition.parties,
        startDate: coalition.startDate,
        endDate: coalition.endDate,
        active: coalition.endDate === null,
      },
      regeerakkoord: {
        title: canonical.note?.replace(/^Regeerakkoord /, "") ?? `Regeerakkoord ${year}`,
        electionYear: year,
        periodStart: canonical.periodStart,
        periodEnd: canonical.periodEnd,
      },
      summary: {
        totalPromises,
        enacted,
        broken,
        pending,
        insufficientData,
        enactedPct: totalPromises > 0 ? Math.round((enacted / totalPromises) * 100) : 0,
        brokenPct: totalPromises > 0 ? Math.round((broken / totalPromises) * 100) : 0,
        pendingPct: totalPromises > 0 ? Math.round((pending / totalPromises) * 100) : 0,
      },
      partyScorecards: validScorecards.map((sc) => ({
        partyId: sc.partyId,
        abbreviation: sc.abbreviation,
        mcs: sc.mandateConsistencyScore,
        consistentCount: sc.consistentCount,
        inconsistentCount: sc.inconsistentCount,
        mixedCount: sc.mixedCount,
        scoredPromises: sc.scoredPromises,
      })),
      byTheme: themes,
      promises: promiseDetails,
    };
  }
}
