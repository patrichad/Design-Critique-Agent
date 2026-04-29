import { CritiqueRequest, CritiqueRequestFrame, CritiqueRequestFrameNode } from "../shared/contracts";

export interface ExtractFramesInput {
  teamId: string;
  userId: string;
  pluginVersion: string;
  mode: CritiqueRequest["mode"];
  selectedFrames: readonly SceneNode[];
  maxDepth?: number;
}

function pickStyle(node: SceneNode): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {
    locked: node.locked,
    opacity: node.opacity,
  };

  if ("layoutMode" in node) base.layoutMode = node.layoutMode;
  if ("itemSpacing" in node) base.itemSpacing = node.itemSpacing;
  if ("fontName" in node && node.type === "TEXT") base.fontName = JSON.stringify(node.fontName);
  if ("fontSize" in node && node.type === "TEXT") base.fontSize = node.fontSize;
  if ("lineHeight" in node && node.type === "TEXT") base.lineHeight = JSON.stringify(node.lineHeight);

  return base;
}

function toTree(node: SceneNode, depth: number, maxDepth: number): CritiqueRequestFrameNode {
  const treeNode: CritiqueRequestFrameNode = {
    nodeId: node.id,
    type: node.type,
    name: node.name,
    visible: node.visible,
    style: pickStyle(node),
  };

  if (node.type === "TEXT") {
    treeNode.text = node.characters.slice(0, 280);
  }

  if ("children" in node && depth < maxDepth) {
    treeNode.children = node.children.map((child) => toTree(child, depth + 1, maxDepth));
  }

  return treeNode;
}

function compactFrame(frame: FrameNode, maxDepth: number): CritiqueRequestFrame {
  return {
    frameId: frame.id,
    frameName: frame.name,
    width: frame.width,
    height: frame.height,
    nodes: frame.children.map((child) => toTree(child, 1, maxDepth)),
  };
}

export function buildCritiqueRequest(input: ExtractFramesInput): CritiqueRequest {
  const maxDepth = input.maxDepth ?? 4;
  const frames = input.selectedFrames
    .filter((node): node is FrameNode => node.type === "FRAME")
    .map((frame) => compactFrame(frame, maxDepth));

  return {
    teamId: input.teamId,
    userId: input.userId,
    pluginVersion: input.pluginVersion,
    mode: input.mode,
    frames,
  };
}
