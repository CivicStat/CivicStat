/**
 * MCS (Mandate Consistency Score) Calculator — v2
 *
 * Improvements over v1:
 * - Confidence-weighted aggregation (B2): effectiveWeight = matchTypeWeight × confidence
 * - Minimum sample threshold (B3): promises with < 3 scored motions → 'insufficient_data'
 * - Sample-size weighting in aggregate (B4): well-matched promises dominate the party score
 */

// ─── Types ───────────────────────────────────────────────────

export interface MatchedMotion {
  matchType: 'EXPLICIT_MATCH' | 'IMPLICIT_MATCH' | 'CONTRADICTS';
  matchConfidence: number; // 0-1
  /** Direction the promise expects the party to vote */
  predictedDirection: 'VOOR' | 'TEGEN';
  /** Actual party vote (null if no vote data available) */
  actualVote: 'VOOR' | 'TEGEN' | null;
}

export interface PromiseConsistency {
  promiseId: string;
  promiseCode: string;
  matchedMotions: number;
  consistencyRatio: number; // 0-1, weighted
  consistencyLabel: 'consistent' | 'mixed' | 'inconsistent' | 'insufficient_data';
  totalWeight: number; // sum of effective weights
  alignedWeight: number; // sum of effective weights for aligned votes
}

export interface PartyMCS {
  partyId: string;
  overallMCS: number; // 0-100, weighted
  totalPromises: number;
  scoredPromises: number; // promises with ≥ MIN_MOTIONS_THRESHOLD motions
  insufficientDataPromises: number;
  promiseScores: PromiseConsistency[];
}

// ─── Constants ───────────────────────────────────────────────

const MATCH_TYPE_WEIGHTS: Record<string, number> = {
  EXPLICIT_MATCH: 1.0,
  IMPLICIT_MATCH: 0.5,
  CONTRADICTS: 1.0, // direction is inverted before comparison
};

/** Minimum number of scored motions required to label a promise */
export const MIN_MOTIONS_THRESHOLD = 3;

// ─── Promise-level Scoring ───────────────────────────────────

export function calculatePromiseConsistency(
  promiseId: string,
  promiseCode: string,
  matches: MatchedMotion[],
): PromiseConsistency {
  // Filter to matches with actual votes
  const scored = matches.filter((m) => m.actualVote !== null);

  if (scored.length < MIN_MOTIONS_THRESHOLD) {
    return {
      promiseId,
      promiseCode,
      matchedMotions: scored.length,
      consistencyRatio: 0,
      consistencyLabel: 'insufficient_data',
      totalWeight: 0,
      alignedWeight: 0,
    };
  }

  let totalWeight = 0;
  let alignedWeight = 0;

  for (const match of scored) {
    const typeWeight = MATCH_TYPE_WEIGHTS[match.matchType] ?? 0.5;
    const effectiveWeight = typeWeight * match.matchConfidence;

    // For CONTRADICTS, invert the expected direction
    const expectedDirection =
      match.matchType === 'CONTRADICTS'
        ? match.predictedDirection === 'VOOR'
          ? 'TEGEN'
          : 'VOOR'
        : match.predictedDirection;

    const isAligned = match.actualVote === expectedDirection;

    totalWeight += effectiveWeight;
    if (isAligned) {
      alignedWeight += effectiveWeight;
    }
  }

  const ratio = totalWeight > 0 ? alignedWeight / totalWeight : 0;

  const label: PromiseConsistency['consistencyLabel'] =
    ratio >= 0.7 ? 'consistent' : ratio >= 0.3 ? 'mixed' : 'inconsistent';

  return {
    promiseId,
    promiseCode,
    matchedMotions: scored.length,
    consistencyRatio: ratio,
    consistencyLabel: label,
    totalWeight,
    alignedWeight,
  };
}

// ─── Party-level Aggregate ───────────────────────────────────

export function calculatePartyMCS(
  partyId: string,
  promiseScores: PromiseConsistency[],
): PartyMCS {
  const scored = promiseScores.filter(
    (p) => p.consistencyLabel !== 'insufficient_data',
  );
  const insufficient = promiseScores.filter(
    (p) => p.consistencyLabel === 'insufficient_data',
  );

  if (scored.length === 0) {
    return {
      partyId,
      overallMCS: 0,
      totalPromises: promiseScores.length,
      scoredPromises: 0,
      insufficientDataPromises: insufficient.length,
      promiseScores,
    };
  }

  // Weight each promise's contribution by its total effective weight.
  // This means well-matched promises with high-confidence matches
  // dominate the aggregate score.
  let weightedSum = 0;
  let totalWeights = 0;

  for (const promise of scored) {
    weightedSum += promise.consistencyRatio * promise.totalWeight;
    totalWeights += promise.totalWeight;
  }

  const overallMCS =
    totalWeights > 0 ? (weightedSum / totalWeights) * 100 : 0;

  return {
    partyId,
    overallMCS: Math.round(overallMCS * 10) / 10, // 1 decimal
    totalPromises: promiseScores.length,
    scoredPromises: scored.length,
    insufficientDataPromises: insufficient.length,
    promiseScores,
  };
}
