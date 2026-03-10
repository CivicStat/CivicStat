import { Injectable } from "@nestjs/common";
import { prisma } from "@ntp/db";

// ─── Weights ─────────────────────────────────────────────────

const MOTION_TYPE_WEIGHTS: Record<string, number> = {
  'Wetsvoorstel': 2.0,
  'Amendement': 1.5,
  'Motie': 1.0,
};

// ─── Types ───────────────────────────────────────────────────

export interface PartyPredictionResult {
  partyId: string;
  abbreviation: string;
  name: string;
  seats: number;
  predictedDirection: "FOR" | "AGAINST" | "UNKNOWN";
  confidence: number; // 0-1 how sure we are about this party's direction
  matchCount: number; // how many matches drive this prediction
  explicitCount: number; // how many EXPLICIT_MATCH matches
}

export interface MotionPredictionResult {
  motionId: string;
  predictedVoor: number; // total seats expected to vote for
  predictedTegen: number; // total seats expected to vote against
  predictedOnbekend: number; // seats with no prediction
  reliability: number; // 0-1 overall reliability
  partyPredictions: PartyPredictionResult[];
  algorithm: string;
}

@Injectable()
export class PredictionsService {
  /**
   * Compute the expected vote outcome for a motion based on promise matches.
   * Works for any motion — voted or not.
   */
  async predictMotion(motionId: string): Promise<MotionPredictionResult | null> {
    // 1. Get all matches for this motion with promise → program → party chain
    const matches = await prisma.promiseMotionMatch.findMany({
      where: { motionId },
      select: {
        matchType: true,
        confidence: true,
        predictedDirection: true,
        motion: { select: { soort: true } },
        promise: {
          select: {
            expectedVoteDirection: true,
            program: {
              select: {
                party: {
                  select: {
                    id: true,
                    abbreviation: true,
                    name: true,
                    seats: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (matches.length === 0) return null;

    // 2. Get all active parties with seats (for the "onbekend" calculation)
    const allParties = await prisma.party.findMany({
      where: { seats: { gt: 0 } },
      select: { id: true, abbreviation: true, name: true, seats: true },
    });

    // 3. Group matches by party
    const partyMatchMap = new Map<
      string,
      { party: { id: string; abbreviation: string; name: string; seats: number | null }; matches: typeof matches }
    >();

    for (const match of matches) {
      const party = match.promise?.program?.party;
      if (!party) continue;
      if (!partyMatchMap.has(party.id)) {
        partyMatchMap.set(party.id, { party, matches: [] });
      }
      partyMatchMap.get(party.id)!.matches.push(match);
    }

    // 4. For each party, determine predicted direction
    const partyPredictions: PartyPredictionResult[] = [];
    const predictedPartyIds = new Set<string>();

    for (const [partyId, { party, matches: partyMatches }] of partyMatchMap) {
      if (!party.seats) continue;

      const { direction, confidence, explicitCount } =
        this.resolvePartyDirection(partyMatches);
      predictedPartyIds.add(partyId);

      partyPredictions.push({
        partyId: party.id,
        abbreviation: party.abbreviation,
        name: party.name,
        seats: party.seats,
        predictedDirection: direction,
        confidence,
        matchCount: partyMatches.length,
        explicitCount,
      });
    }

    // 5. Add parties with no prediction as UNKNOWN
    for (const party of allParties) {
      if (predictedPartyIds.has(party.id)) continue;
      partyPredictions.push({
        partyId: party.id,
        abbreviation: party.abbreviation,
        name: party.name ?? "",
        seats: party.seats ?? 0,
        predictedDirection: "UNKNOWN",
        confidence: 0,
        matchCount: 0,
        explicitCount: 0,
      });
    }

    // Sort by seats descending for display
    partyPredictions.sort((a, b) => b.seats - a.seats);

    // 6. Sum up totals
    let predictedVoor = 0;
    let predictedTegen = 0;
    let predictedOnbekend = 0;
    let reliabilityNumerator = 0;
    let reliabilityDenominator = 0;

    for (const pp of partyPredictions) {
      reliabilityDenominator += pp.seats;

      if (pp.predictedDirection === "FOR") {
        predictedVoor += pp.seats;
        reliabilityNumerator += pp.seats * pp.confidence;
      } else if (pp.predictedDirection === "AGAINST") {
        predictedTegen += pp.seats;
        reliabilityNumerator += pp.seats * pp.confidence;
      } else {
        predictedOnbekend += pp.seats;
      }
    }

    const reliability =
      reliabilityDenominator > 0
        ? reliabilityNumerator / reliabilityDenominator
        : 0;

    return {
      motionId,
      predictedVoor,
      predictedTegen,
      predictedOnbekend,
      reliability: Math.round(reliability * 100) / 100,
      partyPredictions,
      algorithm: "promise-signal-v2",
    };
  }

  /**
   * Resolve a party's predicted vote direction from its promise matches.
   *
   * Logic:
   * - EXPLICIT_MATCH has weight 1.0
   * - IMPLICIT_MATCH has weight 0.4
   * - CONTRADICTS inverts the direction and has weight 1.0
   * - predictedDirection on the match ("VOOR"/"TEGEN") tells us the direction
   * - We sum up weighted scores per direction and pick the stronger one
   */
  private resolvePartyDirection(
    matches: {
      matchType: string;
      confidence: number;
      predictedDirection: string | null;
      motion?: { soort: string | null } | null;
      promise: {
        expectedVoteDirection: string | null;
      } | null;
    }[],
  ): {
    direction: "FOR" | "AGAINST" | "UNKNOWN";
    confidence: number;
    explicitCount: number;
  } {
    let voorScore = 0;
    let tegenScore = 0;
    let explicitCount = 0;

    for (const match of matches) {
      // Match type weight
      const matchType = match.matchType;
      const weight =
        matchType === "EXPLICIT_MATCH"
          ? 1.0
          : matchType === "IMPLICIT_MATCH"
            ? 0.4
            : matchType === "CONTRADICTS"
              ? 1.0
              : 0.3;

      if (matchType === "EXPLICIT_MATCH") explicitCount++;

      // Confidence from the match itself
      const matchConfidence = match.confidence ?? 0.5;

      // Determine effective direction
      // predictedDirection is "VOOR" or "TEGEN" (from semantic-claude matcher)
      // expectedVoteDirection on the promise is "FOR" or "AGAINST"
      let effectiveDirection: string | null =
        match.predictedDirection ?? match.promise?.expectedVoteDirection ?? null;

      // Normalize to FOR/AGAINST
      if (effectiveDirection === "VOOR") effectiveDirection = "FOR";
      else if (effectiveDirection === "TEGEN") effectiveDirection = "AGAINST";

      // For CONTRADICTS: invert the direction
      if (matchType === "CONTRADICTS") {
        effectiveDirection =
          effectiveDirection === "FOR" ? "AGAINST" : "FOR";
      }

      // If no direction could be determined, default based on match type
      if (!effectiveDirection || (effectiveDirection !== "FOR" && effectiveDirection !== "AGAINST")) {
        effectiveDirection = matchType === "CONTRADICTS" ? "AGAINST" : "FOR";
      }

      const motionTypeWeight = MOTION_TYPE_WEIGHTS[match.motion?.soort ?? 'Motie'] ?? 1.0;
      const score = weight * matchConfidence * motionTypeWeight;
      if (effectiveDirection === "FOR") {
        voorScore += score;
      } else {
        tegenScore += score;
      }
    }

    const total = voorScore + tegenScore;
    if (total === 0)
      return { direction: "UNKNOWN", confidence: 0, explicitCount };

    const direction =
      voorScore >= tegenScore ? ("FOR" as const) : ("AGAINST" as const);
    const confidence =
      Math.round((Math.max(voorScore, tegenScore) / total) * 100) / 100;

    return { direction, confidence, explicitCount };
  }
}
