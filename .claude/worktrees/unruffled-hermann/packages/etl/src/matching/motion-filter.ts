/**
 * Motion type filter for CivicStat matching pipeline.
 *
 * Excludes procedural motions (no-confidence, order, adjournment) that
 * share keywords with policy promises but are unrelated in substance.
 *
 * Example: PVV's asylum promise matched to no-confidence motions because
 * both contain "opzeggen."
 */

// Procedural motion patterns to exclude from matching
const PROCEDURAL_PATTERNS = {
  noConfidence: [
    /motie van wantrouwen/i,
    /opzeggen van het vertrouwen in/i,
    /vertrouwen in de minister/i,
    /vertrouwen in het kabinet/i,
    /vertrouwen in de staatssecretaris/i,
    /vertrouwen in de minister-president/i,
  ],
  orderMotions: [
    /motie van orde/i,
    /orde van de dag/i,
    /verzoekt de voorzitter/i,
    /schorsing van de vergadering/i,
  ],
  procedural: [
    /regeling van werkzaamheden/i,
    /plenaire agenda/i,
    /procedurevergadering/i,
    /rapporteurschap/i,
  ],
} as const;

export interface MotionFilterResult {
  excluded: boolean;
  reason?: string;
  category?: 'no-confidence' | 'order' | 'procedural';
}

const CATEGORY_MAP: Record<string, MotionFilterResult['category']> = {
  noConfidence: 'no-confidence',
  orderMotions: 'order',
  procedural: 'procedural',
};

/**
 * Check if a motion is procedural based on its text content.
 */
export function isProceduralMotion(
  title: string,
  description?: string,
): MotionFilterResult {
  const text = `${title} ${description || ''}`;

  for (const [categoryKey, patterns] of Object.entries(PROCEDURAL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return {
          excluded: true,
          reason: `Procedural motion (${categoryKey}): matches pattern "${pattern.source}"`,
          category: CATEGORY_MAP[categoryKey],
        };
      }
    }
  }

  return { excluded: false };
}

// Known procedural soort values from the TK API
const PROCEDURAL_SOORT = [
  'Motie van wantrouwen',
  'Motie van orde',
  'Motie van afkeuring',
];

/**
 * Primary filter: checks soort metadata first, then falls back to regex.
 * Use this in the matching pipeline.
 */
export function shouldMatchMotion(motion: {
  title: string;
  description?: string;
  soort?: string | null;
}): MotionFilterResult {
  // Primary: filter by motion type metadata if available
  if (motion.soort) {
    if (PROCEDURAL_SOORT.includes(motion.soort)) {
      return {
        excluded: true,
        reason: `Motion type: ${motion.soort}`,
        category: 'procedural',
      };
    }
  }

  // Secondary: regex pattern matching on content
  return isProceduralMotion(motion.title, motion.description);
}
