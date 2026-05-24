import { IncomingMessage, ServerResponse } from "http";
import { CritiqueRequest } from "../../../shared/contracts";
import { parseBearerToken, verifyAccessToken } from "../../services/auth/auth";
import { getCachedCritique, requestHash, setCachedCritique } from "../../services/cache/critiqueCache";
import { runCritiqueOrchestrator } from "../../services/critique/orchestrator";
import { confidenceGate, sanitizeIssueContent } from "../../services/critique/safeguards";
import { trackEvent } from "../../services/telemetry/metrics";

const MAX_PAYLOAD_BYTES = 1024 * 1024 * 2;

async function readJsonBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    total += buffer.byteLength;
    if (total > MAX_PAYLOAD_BYTES) {
      throw new Error("Payload too large");
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export async function handleCreateCritique(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const token = parseBearerToken(request.headers.authorization ?? null);
    const auth = verifyAccessToken(token);

    const body = await readJsonBody(request);
    const payload = JSON.parse(body) as CritiqueRequest;

    if (payload.teamId !== auth.teamId || payload.userId !== auth.userId) {
      writeJson(response, 403, { error: "Token identity does not match request payload" });
      return;
    }

    if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
      writeJson(response, 400, { error: "At least one frame is required" });
      return;
    }

    const hash = requestHash(payload);
    const cached = getCachedCritique(hash);
    const result = cached ?? (await runCritiqueOrchestrator(payload));
    if (!cached) {
      setCachedCritique(hash, result);
    }

    const filteredIssues = result.issues.map(sanitizeIssueContent).filter(confidenceGate);
    const filteredResult = {
      ...result,
      issues: filteredIssues,
    };

    trackEvent("critique_completed", {
      teamId: payload.teamId,
      mode: payload.mode,
      frameCount: payload.frames.length,
      cached: Boolean(cached),
      issueCount: filteredResult.issues.length,
    });

    writeJson(response, 200, filteredResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = message.includes("Payload too large") ? 413 : 400;
    writeJson(response, statusCode, { error: message });
  }
}
