import {
  CritiqueRequest,
  CritiqueRequestFrame,
  CritiqueRequestFrameNode,
  FrameSignals,
} from "../shared/contracts";

export interface ExtractFramesInput {
  teamId: string;
  userId: string;
  pluginVersion: string;
  mode: CritiqueRequest["mode"];
  selectedFrames: readonly SceneNode[];
  maxDepth?: number;
}

const COMPONENT_NAME_HINTS = [
  "button",
  "card",
  "input",
  "tag",
  "chip",
  "modal",
  "dialog",
  "toast",
  "badge",
  "avatar",
  "alert",
  "tooltip",
  "tab",
];

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function paintColor(paint: Paint): string | null {
  if (paint.type === "SOLID") {
    return rgbToHex(paint.color.r, paint.color.g, paint.color.b);
  }
  return null;
}

function firstSolidFill(node: SceneNode): string | null {
  if (!("fills" in node)) return null;
  const fills = node.fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return null;
  for (const paint of fills) {
    if (!paint.visible) continue;
    const hex = paintColor(paint);
    if (hex) return hex;
  }
  return null;
}

function firstSolidStroke(node: SceneNode): string | null {
  if (!("strokes" in node)) return null;
  const strokes = node.strokes;
  if (!Array.isArray(strokes)) return null;
  for (const paint of strokes) {
    if (!paint.visible) continue;
    const hex = paintColor(paint);
    if (hex) return hex;
  }
  return null;
}

async function pickStyle(
  node: SceneNode,
): Promise<Record<string, string | number | boolean>> {
  const base: Record<string, string | number | boolean> = {};
  if ("locked" in node && typeof node.locked === "boolean") base.locked = node.locked;
  if ("opacity" in node && typeof (node as { opacity: number }).opacity === "number") {
    base.opacity = (node as { opacity: number }).opacity;
  }

  if ("layoutMode" in node) {
    base.layoutMode = node.layoutMode;
    base.itemSpacing = node.itemSpacing;
    base.paddingTop = node.paddingTop;
    base.paddingRight = node.paddingRight;
    base.paddingBottom = node.paddingBottom;
    base.paddingLeft = node.paddingLeft;
    base.primaryAxisAlignItems = node.primaryAxisAlignItems;
    base.counterAxisAlignItems = node.counterAxisAlignItems;
  }

  if ("cornerRadius" in node) {
    const r = node.cornerRadius;
    if (typeof r === "number") base.cornerRadius = r;
  }

  if ("strokeWeight" in node) {
    const sw = node.strokeWeight;
    if (typeof sw === "number") base.strokeWeight = sw;
  }

  if (node.type === "TEXT") {
    if (typeof node.fontSize === "number") base.fontSize = node.fontSize;
    if (typeof node.fontName !== "symbol") base.fontName = JSON.stringify(node.fontName);
    if (typeof node.lineHeight !== "symbol") base.lineHeight = JSON.stringify(node.lineHeight);
    if (typeof node.fontWeight === "number") base.fontWeight = node.fontWeight;
  }

  const fill = firstSolidFill(node);
  if (fill) base.fill = fill;
  const stroke = firstSolidStroke(node);
  if (stroke) base.stroke = stroke;

  if (node.type === "INSTANCE") {
    base.isInstance = true;
    try {
      const main = await (node as InstanceNode).getMainComponentAsync();
      if (main) base.mainComponentName = main.name;
    } catch {
      // ignore: main component may be unavailable in dynamic-page mode
    }
  }
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    base.isComponent = true;
  }

  return base;
}

async function toTree(
  node: SceneNode,
  depth: number,
  maxDepth: number,
): Promise<CritiqueRequestFrameNode> {
  const treeNode: CritiqueRequestFrameNode = {
    nodeId: node.id,
    type: node.type,
    name: node.name,
    visible: node.visible,
    style: await pickStyle(node),
  };

  if (node.type === "TEXT") {
    treeNode.text = node.characters.slice(0, 280);
  }

  if ("children" in node && depth < maxDepth) {
    treeNode.children = await Promise.all(
      node.children.map((child) => toTree(child, depth + 1, maxDepth)),
    );
  }

  return treeNode;
}

function walkNodes(node: SceneNode, visit: (n: SceneNode) => void): void {
  visit(node);
  if ("children" in node) {
    for (const child of node.children) walkNodes(child, visit);
  }
}

function computeSignals(frame: FrameNode): FrameSignals {
  const fontSizes = new Set<number>();
  const spacingValues = new Set<number>();
  const cornerRadii = new Set<number>();
  const colors = new Set<string>();
  const detachedCandidates: string[] = [];
  let instanceCount = 0;
  let childCount = 0;

  walkNodes(frame, (n) => {
    if (n === frame) return;
    childCount += 1;

    if (n.type === "INSTANCE") instanceCount += 1;

    if (n.type === "TEXT" && typeof n.fontSize === "number") {
      fontSizes.add(n.fontSize);
    }

    if ("layoutMode" in n && n.layoutMode !== "NONE") {
      if (typeof n.itemSpacing === "number") spacingValues.add(n.itemSpacing);
      [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].forEach((v) => {
        if (typeof v === "number" && v > 0) spacingValues.add(v);
      });
    }

    if ("cornerRadius" in n) {
      const r = (n as { cornerRadius: number | typeof figma.mixed }).cornerRadius;
      if (typeof r === "number" && r > 0) cornerRadii.add(r);
    }

    const fill = firstSolidFill(n);
    if (fill) colors.add(fill);

    const lower = n.name.toLowerCase();
    const looksLikeComponent = COMPONENT_NAME_HINTS.some((hint) => lower.includes(hint));
    const isContainer = n.type === "FRAME" || n.type === "GROUP";
    if (looksLikeComponent && isContainer) {
      detachedCandidates.push(n.name);
    }
  });

  return {
    hasAutoLayout: frame.layoutMode !== "NONE",
    childCount,
    instanceCount,
    detachedCandidates: detachedCandidates.slice(0, 20),
    uniqueFontSizes: Array.from(fontSizes).sort((a, b) => a - b),
    uniqueSpacingValues: Array.from(spacingValues).sort((a, b) => a - b),
    uniqueCornerRadii: Array.from(cornerRadii).sort((a, b) => a - b),
    uniqueColors: Array.from(colors).slice(0, 24),
  };
}

async function compactFrame(
  frame: FrameNode,
  maxDepth: number,
): Promise<CritiqueRequestFrame> {
  const nodes = await Promise.all(
    frame.children.map((child) => toTree(child, 1, maxDepth)),
  );
  return {
    frameId: frame.id,
    frameName: frame.name,
    width: frame.width,
    height: frame.height,
    nodes,
    signals: computeSignals(frame),
  };
}

export async function buildCritiqueRequest(
  input: ExtractFramesInput,
): Promise<CritiqueRequest> {
  const maxDepth = input.maxDepth ?? 4;
  const frameNodes = input.selectedFrames.filter(
    (node): node is FrameNode => node.type === "FRAME",
  );
  const frames = await Promise.all(
    frameNodes.map((frame) => compactFrame(frame, maxDepth)),
  );

  return {
    teamId: input.teamId,
    userId: input.userId,
    pluginVersion: input.pluginVersion,
    mode: input.mode,
    frames,
  };
}
