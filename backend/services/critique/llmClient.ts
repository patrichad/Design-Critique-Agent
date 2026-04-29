import { CritiqueIssue, CritiqueRequest, normalizeConfidence } from "../../../shared/contracts";

export interface LlmClient {
  generateIssues(request: CritiqueRequest): Promise<CritiqueIssue[]>;
}

export class MockLlmClient implements LlmClient {
  async generateIssues(request: CritiqueRequest): Promise<CritiqueIssue[]> {
    // Replace with a real model provider integration (OpenAI, Anthropic, etc).
    return request.frames.flatMap((frame) => [
      {
        issueId: crypto.randomUUID(),
        frameId: frame.frameId,
        title: "Primary CTA lacks strong visual emphasis",
        detail:
          "The CTA does not clearly stand out from secondary actions, reducing scan clarity and conversion intent.",
        recommendedFix:
          "Increase contrast, weight, and spacing around the primary action while reducing visual weight of secondary actions.",
        severity: "high",
        category: "interaction_affordance",
        confidence: normalizeConfidence(0.88),
        tokensCost: request.mode === "deep" ? 1200 : 300,
      },
    ]);
  }
}
