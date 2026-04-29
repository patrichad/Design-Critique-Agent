"use strict";
(() => {
  // plugin/extractFrames.ts
  function pickStyle(node) {
    const base = {
      locked: node.locked,
      opacity: node.opacity
    };
    if ("layoutMode" in node) base.layoutMode = node.layoutMode;
    if ("itemSpacing" in node) base.itemSpacing = node.itemSpacing;
    if ("fontName" in node && node.type === "TEXT") base.fontName = JSON.stringify(node.fontName);
    if ("fontSize" in node && node.type === "TEXT") base.fontSize = node.fontSize;
    if ("lineHeight" in node && node.type === "TEXT") base.lineHeight = JSON.stringify(node.lineHeight);
    return base;
  }
  function toTree(node, depth, maxDepth) {
    const treeNode = {
      nodeId: node.id,
      type: node.type,
      name: node.name,
      visible: node.visible,
      style: pickStyle(node)
    };
    if (node.type === "TEXT") {
      treeNode.text = node.characters.slice(0, 280);
    }
    if ("children" in node && depth < maxDepth) {
      treeNode.children = node.children.map((child) => toTree(child, depth + 1, maxDepth));
    }
    return treeNode;
  }
  function compactFrame(frame, maxDepth) {
    return {
      frameId: frame.id,
      frameName: frame.name,
      width: frame.width,
      height: frame.height,
      nodes: frame.children.map((child) => toTree(child, 1, maxDepth))
    };
  }
  function buildCritiqueRequest(input) {
    var _a;
    const maxDepth = (_a = input.maxDepth) != null ? _a : 4;
    const frames = input.selectedFrames.filter((node) => node.type === "FRAME").map((frame) => compactFrame(frame, maxDepth));
    return {
      teamId: input.teamId,
      userId: input.userId,
      pluginVersion: input.pluginVersion,
      mode: input.mode,
      frames
    };
  }

  // plugin/code.ts
  var SETTINGS_KEY = "design-critique-agent.settings";
  figma.showUI(__html__, { width: 460, height: 640 });
  async function loadSettings() {
    const value = await figma.clientStorage.getAsync(SETTINGS_KEY);
    return value != null ? value : null;
  }
  async function saveSettings(settings) {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  }
  figma.ui.onmessage = async (message) => {
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
      const request = buildCritiqueRequest({
        teamId: "local",
        userId: "local",
        pluginVersion: "0.2.0",
        mode: message.mode,
        selectedFrames
      });
      if (request.frames.length === 0) {
        figma.ui.postMessage({
          type: "REQUEST_ERROR",
          error: "Select at least one frame before running critique."
        });
        return;
      }
      figma.ui.postMessage({ type: "REQUEST_BUILT", payload: request });
    } catch (error) {
      figma.ui.postMessage({
        type: "REQUEST_ERROR",
        error: error instanceof Error ? error.message : "Unknown plugin error"
      });
    }
  };
})();
