/**
 * Canonical FDD/FV skill schema — the source of truth for frontmatter validation.
 */

export const VALID_TYPES = ['skill', 'retro', 'moc', 'agent', 'template'] as const;
export type SkillType = (typeof VALID_TYPES)[number];

export const VALID_STATUSES = ['stable', 'draft', 'deprecated'] as const;
export type SkillStatus = (typeof VALID_STATUSES)[number];

export const VALID_DOF = [1, 2, 3] as const;

/** Canonical phase strings. Key = phase number, value = full label. */
export const CANONICAL_PHASES: Record<string, string> = {
  '00': '00 — Pre-Engagement',
  '01': '01 — Data Acquisition',
  '02': '02 — Trial Balance',
  '03': '03 — Databook',
  '04': '04 — Analysis',
  '05': '05 — Management Session',
  '06': '06 — Review',
  '07': '07 — Deliverables',
  retro: 'retro',
  agents: 'agents',
};

/** Canonical discipline names grouped by phase. */
export const CANONICAL_DISCIPLINES: Record<string, string[]> = {
  '00': ['Targeting', 'Scoping'],
  '01': ['Dataroom'],
  '02': ['Trial Balance'],
  '03': ['Databook'],
  '04': ['Earnings', 'Working Capital', 'Assets & Debt', 'Analytics', 'Other'],
  '05': ['Management Q&A'],
  '06': ['Review'],
  '07': ['Deliverables'],
  retro: ['Retrospective'],
  agents: ['Agents'],
};

/** Flatten all valid discipline names. */
export const ALL_DISCIPLINES = Object.values(CANONICAL_DISCIPLINES).flat();
