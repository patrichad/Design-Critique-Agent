import { IncomingMessage, ServerResponse } from "http";
import { parseBearerToken, verifyAccessToken } from "../../services/auth/auth";
import {
  createCheckoutSession,
  handleStripeWebhookEvent,
  StripeWebhookEvent,
} from "../../services/billing/stripe";

const requestCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function enforceRateLimit(key: string): void {
  const now = Date.now();
  const entry = requestCounts.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("Rate limit exceeded");
  }
  entry.count += 1;
  requestCounts.set(key, entry);
}

export async function handleCreateCheckout(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const token = parseBearerToken(request.headers.authorization ?? null);
    const auth = verifyAccessToken(token);
    enforceRateLimit(auth.teamId);

    const body = JSON.parse(await readBody(request)) as { teamId: string; packId: string };
    if (body.teamId !== auth.teamId) {
      writeJson(response, 403, { error: "Token team does not match payload team" });
      return;
    }

    const session = createCheckoutSession(body.teamId, body.packId);
    writeJson(response, 200, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown billing error";
    const statusCode = message.includes("Rate limit") ? 429 : 400;
    writeJson(response, statusCode, { error: message });
  }
}

export async function handleStripeWebhook(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const event = JSON.parse(await readBody(request)) as StripeWebhookEvent;
    const result = handleStripeWebhookEvent(event);
    writeJson(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    writeJson(response, 400, { error: message });
  }
}
