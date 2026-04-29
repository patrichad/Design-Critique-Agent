import { creditWallet } from "./creditLedger";

export interface CreditPack {
  packId: string;
  credits: number;
  priceCents: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { packId: "starter", credits: 100, priceCents: 900 },
  { packId: "pro", credits: 500, priceCents: 3900 },
  { packId: "scale", credits: 2000, priceCents: 12900 },
];

export interface CheckoutSession {
  checkoutUrl: string;
  teamId: string;
  packId: string;
}

export function createCheckoutSession(teamId: string, packId: string): CheckoutSession {
  const pack = CREDIT_PACKS.find((item) => item.packId === packId);
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`);

  // Placeholder: return a URL from your backend-created Stripe Checkout session.
  return {
    teamId,
    packId,
    checkoutUrl: `https://checkout.stripe.com/pay/mock-${teamId}-${pack.packId}`,
  };
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      metadata?: Record<string, string>;
    };
  };
}

export function handleStripeWebhookEvent(event: StripeWebhookEvent): { credited: boolean; balance?: number } {
  if (event.type !== "checkout.session.completed") {
    return { credited: false };
  }

  const metadata = event.data.object.metadata ?? {};
  const teamId = metadata.teamId;
  const packId = metadata.packId;
  if (!teamId || !packId) {
    throw new Error("Missing teamId/packId metadata in Stripe event");
  }

  const pack = CREDIT_PACKS.find((item) => item.packId === packId);
  if (!pack) throw new Error(`Unknown credit pack in webhook: ${packId}`);

  const wallet = creditWallet(teamId, pack.credits);
  return { credited: true, balance: wallet.balance };
}
