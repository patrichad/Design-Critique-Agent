import { buildCritiqueRequest } from "./extractFrames";
import { CritiqueRequest } from "../shared/contracts";

type Provider = "openai" | "anthropic";

interface SavedSettings {
  provider: Provider;
  openaiKey?: string;
  anthropicKey?: string;
  model?: string;
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

figma.showUI(__html__, { width: 460, height: 640 });

async function loadSettings(): Promise<SavedSettings | null> {
  const value = await figma.clientStorage.getAsync(SETTINGS_KEY);
  return (value as SavedSettings | undefined) ?? null;
}

async function saveSettings(settings: SavedSettings): Promise<void> {
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
}

figma.ui.onmessage = async (message: IncomingMessage) => {
  if (message.type === "LOAD_SETTINGS") {
    const settings = await loadSettings();
    figma.ui.postMessage({ type: "SETTINGS_LOADED", settings });
    return;
  }

  if (message.type === "SAVE_SETTINGS") {
    await saveSettings(message.settings);
    figma.ui.postMessage({ type: "SETTINGS_SAVED" });
    return;
  }

  if (message.type !== "BUILD_REQUEST") return;

  try {
    const selectedFrames = figma.currentPage.selection;
    const request: CritiqueRequest = buildCritiqueRequest({
      teamId: "local",
      userId: "local",
      pluginVersion: "0.2.0",
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

    figma.ui.postMessage({ type: "REQUEST_BUILT", payload: request });
  } catch (error) {
    figma.ui.postMessage({
      type: "REQUEST_ERROR",
      error: error instanceof Error ? error.message : "Unknown plugin error",
    });
  }
};
