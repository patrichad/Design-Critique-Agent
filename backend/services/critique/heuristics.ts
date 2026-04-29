import { CritiqueIssue, CritiqueRequest, normalizeConfidence } from "../../../shared/contracts";

export function runHeuristicChecks(request: CritiqueRequest): CritiqueIssue[] {
  const issues: CritiqueIssue[] = [];

  for (const frame of request.frames) {
    if (frame.width < 320) {
      issues.push({
        issueId: crypto.randomUUID(),
        frameId: frame.frameId,
        title: "Frame width is narrow for common breakpoints",
        detail:
          "This frame is below common mobile baseline widths and may hide layout issues in production screens.",
        recommendedFix: "Validate at 375px+ and confirm responsive constraints on key containers.",
        severity: "medium",
        category: "visual_hierarchy",
        confidence: normalizeConfidence(0.82),
        tokensCost: 0,
      });
    }

    for (const node of frame.nodes) {
      if (node.type === "TEXT" && (!node.text || node.text.trim().length < 2)) {
        issues.push({
          issueId: crypto.randomUUID(),
          frameId: frame.frameId,
          nodeId: node.nodeId,
          title: "Text layer appears empty or placeholder-like",
          detail: "Short text content can indicate missing copy or unresolved placeholder labels.",
          recommendedFix: "Replace placeholder copy with meaningful labels and localized production content.",
          severity: "low",
          category: "copy_clarity",
          confidence: normalizeConfidence(0.74),
          tokensCost: 0,
        });
      }
    }
  }

  return issues;
}
