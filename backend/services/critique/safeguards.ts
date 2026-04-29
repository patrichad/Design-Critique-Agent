import { CritiqueIssue } from "../../../shared/contracts";

const SENSITIVE_PATTERNS = [/api[_-]?key/i, /secret/i, /password/i, /token/i];

function scrubText(text: string): string {
  let output = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    output = output.replace(pattern, "[redacted]");
  }
  return output;
}

export function sanitizeIssueContent(issue: CritiqueIssue): CritiqueIssue {
  return {
    ...issue,
    title: scrubText(issue.title),
    detail: scrubText(issue.detail),
    recommendedFix: scrubText(issue.recommendedFix),
  };
}

export function confidenceGate(issue: CritiqueIssue): boolean {
  if (issue.severity === "critical") return issue.confidence >= 0.75;
  if (issue.severity === "high") return issue.confidence >= 0.65;
  return issue.confidence >= 0.5;
}
