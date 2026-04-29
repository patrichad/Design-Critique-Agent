export interface CreditWallet {
  teamId: string;
  balance: number;
}

export interface UsageEvent {
  usageId: string;
  teamId: string;
  critiqueId: string;
  mode: "quick" | "deep";
  framesAnalyzed: number;
  creditsDebited: number;
  timestamp: string;
}

const wallets = new Map<string, CreditWallet>();
const usageEvents: UsageEvent[] = [];

export function seedWallet(teamId: string, amount: number): CreditWallet {
  const wallet = { teamId, balance: amount };
  wallets.set(teamId, wallet);
  return wallet;
}

export function getWallet(teamId: string): CreditWallet {
  const existing = wallets.get(teamId);
  if (existing) return existing;
  return seedWallet(teamId, 0);
}

export function estimateCredits(mode: "quick" | "deep", frameCount: number): number {
  const perFrame = mode === "quick" ? 1 : 3;
  return perFrame * frameCount;
}

export function assertSufficientCredits(teamId: string, neededCredits: number): void {
  const wallet = getWallet(teamId);
  if (wallet.balance < neededCredits) {
    throw new Error(`Insufficient credits: need ${neededCredits}, available ${wallet.balance}`);
  }
}

export function debitCreditsAndStoreUsage(input: {
  teamId: string;
  critiqueId: string;
  mode: "quick" | "deep";
  framesAnalyzed: number;
  creditsDebited: number;
}): UsageEvent {
  const wallet = getWallet(input.teamId);
  assertSufficientCredits(input.teamId, input.creditsDebited);

  wallet.balance -= input.creditsDebited;
  wallets.set(input.teamId, wallet);

  const event: UsageEvent = {
    usageId: crypto.randomUUID(),
    teamId: input.teamId,
    critiqueId: input.critiqueId,
    mode: input.mode,
    framesAnalyzed: input.framesAnalyzed,
    creditsDebited: input.creditsDebited,
    timestamp: new Date().toISOString(),
  };

  usageEvents.push(event);
  return event;
}

export function listUsageEvents(teamId: string): UsageEvent[] {
  return usageEvents.filter((event) => event.teamId === teamId);
}

export function creditWallet(teamId: string, amount: number): CreditWallet {
  if (amount <= 0) {
    throw new Error("Top-up amount must be positive");
  }
  const wallet = getWallet(teamId);
  wallet.balance += amount;
  wallets.set(teamId, wallet);
  return wallet;
}
