import { CritiqueIssue, CritiqueRequest, CritiqueResponse, validateIssue } from "../../../shared/contracts";
import { runHeuristicChecks } from "./heuristics";
import { LlmClient, MockLlmClient } from "./llmClient";

function rankIssues(issues: CritiqueIssue[]): CritiqueIssue[] {
  const severityScore: Record<CritiqueIssue["severity"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...issues].sort((a, b) => {
    if (severityScore[b.severity] !== severityScore[a.severity]) {
      return severityScore[b.severity] - severityScore[a.severity];
    }
    return b.confidence - a.confidence;
  });
}

export async function runCritiqueOrchestrator(
  request: CritiqueRequest,
  llmClient: LlmClient = new MockLlmClient(),
): Promise<CritiqueResponse> {
  const heuristicIssues = runHeuristicChecks(request);
  const llmIssues = await llmClient.generateIssues(request);
  const merged = rankIssues([...heuristicIssues, ...llmIssues]);

  const validIssues = merged.filter((issue) => validateIssue(issue).length === 0);
  const totalTokensCost = validIssues.reduce((sum, issue) => sum + issue.tokensCost, 0);

  return {
    critiqueId: crypto.randomUUID(),
    mode: request.mode,
    issues: validIssues,
    totalTokensCost,
  };
}
