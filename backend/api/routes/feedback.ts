import { IncomingMessage, ServerResponse } from "http";
import { parseBearerToken, verifyAccessToken } from "../../services/auth/auth";
import { saveBetaFeedback } from "../../services/feedback/betaFeedback";
import { trackEvent } from "../../services/telemetry/metrics";

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

export async function handleFeedbackCreate(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const token = parseBearerToken(request.headers.authorization ?? null);
    const auth = verifyAccessToken(token);
    const body = JSON.parse(await readBody(request)) as {
      teamId: string;
      userId: string;
      critiqueId: string;
      issueId?: string;
      verdict: "accepted" | "rejected" | "needs_tuning";
      notes?: string;
    };

    if (body.teamId !== auth.teamId || body.userId !== auth.userId) {
      writeJson(response, 403, { error: "Token identity does not match payload identity" });
      return;
    }

    const saved = saveBetaFeedback(body);
    trackEvent("beta_feedback_saved", {
      teamId: body.teamId,
      verdict: body.verdict,
      hasIssue: Boolean(body.issueId),
    });
    writeJson(response, 201, saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown feedback error";
    writeJson(response, 400, { error: message });
  }
}
