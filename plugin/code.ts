import { buildCritiqueRequest } from "./extractFrames";
import { CritiqueRequest } from "../shared/contracts";

type Provider = "openai" | "anthropic";

interface SavedSettings {
  provider: Provider;
  openaiKey?: string;
  anthropicKey?: string;
  model?: string;
  designSystemUrl?: string;
}

interface LoadSettingsMessage {
  type: "LOAD_SETTINGS";
}

interface SaveSettingsMessage {
  type: "SAVE_SETTINGS";
  settings: SavedSettings;
}

interface BuildRequestMessage {
  type: "BUILD_REQUEST";
  mode: "quick" | "deep";
}

type IncomingMessage =
  | LoadSettingsMessage
  | SaveSettingsMessage
  | BuildRequestMessage;

const SETTINGS_KEY = "design-critique-agent.settings";
const TRIAL_KEY = "design-critique-agent.trialRunsLeft";
const TRIAL_LIMIT = 3;
const TRIAL_GATE_ENABLED = true;

figma.showUI(__html__, { width: 460, height: 640 });

async function loadSettings(): Promise<SavedSettings | null> {
  const value = await figma.clientStorage.getAsync(SETTINGS_KEY);
  return (value as SavedSettings | undefined) ?? null;
}

async function saveSettings(settings: SavedSettings): Promise<void> {
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

async function getTrialRunsLeft(): Promise<number> {
  const stored = await figma.clientStorage.getAsync(TRIAL_KEY);
  if (typeof stored === "number") return stored;
  await figma.clientStorage.setAsync(TRIAL_KEY, TRIAL_LIMIT);
  return TRIAL_LIMIT;
}

async function decrementTrial(): Promise<number> {
  const left = await getTrialRunsLeft();
  const next = Math.max(0, left - 1);
  await figma.clientStorage.setAsync(TRIAL_KEY, next);
  return next;
}

type AccessState =
  | { ok: true; mode: "paid" | "trial"; trialLeft?: number }
  | { ok: false; reason: string };

async function ensureAccess(): Promise<AccessState> {
  if (!TRIAL_GATE_ENABLED) {
    return { ok: true, mode: "paid" };
  }

  let payments: PaymentsAPI | undefined;
  try {
    payments = figma.payments;
  } catch {
    payments = undefined;
  }

  if (!payments) {
    return { ok: true, mode: "paid" };
  }

  let status: { type: "PAID" | "UNPAID" } | undefined;
  try {
    status = payments.status;
  } catch {
    return { ok: true, mode: "paid" };
  }

  if (status?.type === "PAID") {
    return { ok: true, mode: "paid" };
  }

  const trialLeft = await getTrialRunsLeft();
  if (trialLeft > 0) {
    return { ok: true, mode: "trial", trialLeft };
  }

  try {
    await payments.initiateCheckoutAsync({ interstitial: "TRIAL_ENDED" });
  } catch {
    return { ok: true, mode: "paid" };
  }

  if (payments.status.type === "PAID") {
    return { ok: true, mode: "paid" };
  }

  return {
    ok: false,
    reason: "Upgrade required to continue running critiques.",
  };
}

async function postAccessStatus(): Promise<void> {
  if (!TRIAL_GATE_ENABLED) {
    figma.ui.postMessage({
      type: "ACCESS_STATUS",
      status: { paid: true, trialLeft: null, trialLimit: TRIAL_LIMIT },
    });
    return;
  }

  let paid = true;
  try {
    paid = !figma.payments || figma.payments.status.type === "PAID";
  } catch {
    paid = true;
  }
  const trialLeft = paid ? null : await getTrialRunsLeft();
  figma.ui.postMessage({
    type: "ACCESS_STATUS",
    status: { paid, trialLeft, trialLimit: TRIAL_LIMIT },
  });
}

figma.ui.onmessage = async (message: IncomingMessage) => {
  if (message.type === "LOAD_SETTINGS") {
    const settings = await loadSettings();
    figma.ui.postMessage({ type: "SETTINGS_LOADED", settings });
    await postAccessStatus();
    return;
  }

  if (message.type === "SAVE_SETTINGS") {
    await saveSettings(message.settings);
    figma.ui.postMessage({ type: "SETTINGS_SAVED" });
    return;
  }

  if (message.type !== "BUILD_REQUEST") return;

  try {
    const access = await ensureAccess();
    if (!access.ok) {
      figma.ui.postMessage({ type: "REQUEST_ERROR", error: access.reason });
      await postAccessStatus();
      return;
    }

    const selectedFrames = figma.currentPage.selection;
    const request: CritiqueRequest = await buildCritiqueRequest({
      teamId: "local",
      userId: "local",
      pluginVersion: "0.3.0",
      mode: message.mode,
      selectedFrames,
    });

    if (request.frames.length === 0) {
      figma.ui.postMessage({
        type: "REQUEST_ERROR",
        error: "Select at least one frame before running critique.",
      });
      return;
    }

    figma.ui.postMessage({ type: "REQUEST_PROGRESS", message: "Exporting frame screenshots..." });
    const frameNodes = selectedFrames.filter(
      (n): n is FrameNode => n.type === "FRAME",
    );
    for (let i = 0; i < request.frames.length; i++) {
      const node = frameNodes[i];
      if (!node) continue;
      try {
        const targetWidth = Math.max(
          256,
          Math.min(1600, Math.round(node.width * 2)),
        );
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "WIDTH", value: targetWidth },
        });
        const b64 = figma.base64Encode(bytes);
        request.frames[i].thumbnailDataUrl = `data:image/png;base64,${b64}`;
      } catch (e) {
        // skip image; still send structured payload
      }
    }

    if (access.mode === "trial") {
      await decrementTrial();
    }

    figma.ui.postMessage({ type: "REQUEST_BUILT", payload: request });
    await postAccessStatus();
  } catch (error) {
    figma.ui.postMessage({
      type: "REQUEST_ERROR",
      error: error instanceof Error ? error.message : "Unknown plugin error",
    });
  }
};
