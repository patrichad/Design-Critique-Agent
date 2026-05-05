export const CRITIQUE_CATEGORIES = [
  "visual_hierarchy",
  "spacing_alignment",
  "accessibility",
  "design_system_consistency",
  "copy_clarity",
  "interaction_affordance",
] as const;

export const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export type CritiqueCategory = (typeof CRITIQUE_CATEGORIES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export type Confidence = number;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CritiqueIssue {
  issueId: string;
  frameId: string;
  nodeId?: string;
  bbox?: BoundingBox;
  title: string;
  detail: string;
  recommendedFix: string;
  severity: IssueSeverity;
  category: CritiqueCategory;
  confidence: Confidence;
  tokensCost: number;
}

export interface CritiqueRequestFrameNode {
  nodeId: string;
  type: string;
  name: string;
  visible: boolean;
  text?: string;
  style?: Record<string, string | number | boolean>;
  children?: CritiqueRequestFrameNode[];
}

export interface FrameSignals {
  hasAutoLayout: boolean;
  childCount: number;
  instanceCount: number;
  detachedCandidates: string[];
  uniqueFontSizes: number[];
  uniqueSpacingValues: number[];
  uniqueCornerRadii: number[];
  uniqueColors: string[];
}

export interface CritiqueRequestFrame {
  frameId: string;
  frameName: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
  thumbnailDataUrl?: string;
  signals?: FrameSignals;
  nodes: CritiqueRequestFrameNode[];
}

export interface CritiqueRequest {
  teamId: string;
  userId: string;
  pluginVersion: string;
  mode: "quick" | "deep";
  frames: CritiqueRequestFrame[];
}

export interface CritiqueResponse {
  critiqueId: string;
  mode: CritiqueRequest["mode"];
  issues: CritiqueIssue[];
  totalTokensCost: number;
}

export interface SeverityRule {
  severity: IssueSeverity;
  definition: string;
  slaHours: number;
}

export const SEVERITY_RUBRIC: SeverityRule[] = [
  {
    severity: "critical",
    definition:
      "Likely to block user task completion, violate accessibility baseline, or create severe UX confusion.",
    slaHours: 4,
  },
  {
    severity: "high",
    definition:
      "Strongly degrades usability or consistency and should be fixed before release.",
    slaHours: 24,
  },
  {
    severity: "medium",
    definition:
      "Noticeable quality issue that impacts polish and trust but is not blocking.",
    slaHours: 72,
  },
  {
    severity: "low",
    definition:
      "Minor improvement or refinement opportunity with low immediate user risk.",
    slaHours: 168,
  },
];

export function normalizeConfidence(value: number): Confidence {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(2));
}

export function inferSeverityFromConfidence(confidence: Confidence): IssueSeverity {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

export function validateIssue(issue: CritiqueIssue): string[] {
  const errors: string[] = [];
  if (!issue.issueId.trim()) errors.push("issueId is required");
  if (!issue.frameId.trim()) errors.push("frameId is required");
  if (!issue.title.trim()) errors.push("title is required");
  if (!issue.detail.trim()) errors.push("detail is required");
  if (!issue.recommendedFix.trim()) errors.push("recommendedFix is required");
  if (!CRITIQUE_CATEGORIES.includes(issue.category)) errors.push("category is invalid");
  if (!ISSUE_SEVERITIES.includes(issue.severity)) errors.push("severity is invalid");
  if (issue.confidence < 0 || issue.confidence > 1) errors.push("confidence must be in range [0,1]");
  if (issue.tokensCost < 0) errors.push("tokensCost must be >= 0");
  return errors;
}
