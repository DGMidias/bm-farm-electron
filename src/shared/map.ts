import { isPortfolioCreateForm } from "./portfolio-fill";
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
  if (node.id === "login" && isPortfolioCreateForm(snapshot.texts)) return 0;
  if (node.id === "unknown") return 1;
  const url = snapshot.url.toLowerCase();
  const blob = `${snapshot.title} ${snapshot.texts.join(" ")}`.toLowerCase();
  const urlParts = node.match?.urlIncludes ?? [];
  const required = node.match?.anyText ?? [];
  let score = 0;
  let urlHits = 0;
  let textHits = 0;
  for (const part of urlParts) {
    if (url.includes(part.toLowerCase())) {
      score += 4;
      urlHits += 1;
    }
  }
  for (const text of required) {
    if (blob.includes(text.toLowerCase())) {
      score += 2;
      textHits += 1;
    }
  }
  if (urlParts.length && urlHits === 0) return 0;
  if (required.length && textHits === 0) return 0;
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
