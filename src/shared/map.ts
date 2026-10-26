import type { ScreenSnapshot } from "./types";

export interface MapNode {
  id: string;
  step?: string;
  match?: {
    urlIncludes?: string[];
    anyText?: string[];
  };
  fields?: string[];
  human?: "login" | "captcha" | "otp" | "envio" | "unknown_screen";
  onMiss?: string[];
}

export interface PageMap {
  version: number;
  name: string;
  nodes: MapNode[];
}

export function scoreNode(node: MapNode, snapshot: ScreenSnapshot): number {
  let score = 0;
  const url = snapshot.url.toLowerCase();
  const blob = `${snapshot.title} ${snapshot.texts.join(" ")}`.toLowerCase();
  for (const part of node.match?.urlIncludes ?? []) {
    if (url.includes(part.toLowerCase())) score += 4;
  }
  for (const text of node.match?.anyText ?? []) {
    if (blob.includes(text.toLowerCase())) score += 2;
  }
  if (node.id === "unknown") score = 1;
  return score;
}

export function detectScreen(map: PageMap, snapshot: ScreenSnapshot): MapNode {
  let best = map.nodes.find((node) => node.id === "unknown") ?? map.nodes[0];
  let bestScore = -1;
  for (const node of map.nodes) {
    const score = scoreNode(node, snapshot);
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}

export function snapshotFromTexts(url: string, title: string, texts: string[]): ScreenSnapshot {
  return { url, title, texts, roles: [] };
}
