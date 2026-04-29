export interface BetaFeedbackItem {
  feedbackId: string;
  teamId: string;
  userId: string;
  critiqueId: string;
  issueId?: string;
  verdict: "accepted" | "rejected" | "needs_tuning";
  notes?: string;
  createdAt: string;
}

const feedbackStore: BetaFeedbackItem[] = [];

export function saveBetaFeedback(
  input: Omit<BetaFeedbackItem, "feedbackId" | "createdAt">,
): BetaFeedbackItem {
  const item: BetaFeedbackItem = {
    ...input,
    feedbackId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  feedbackStore.push(item);
  return item;
}

export function listBetaFeedback(teamId: string): BetaFeedbackItem[] {
  return feedbackStore.filter((item) => item.teamId === teamId);
}
