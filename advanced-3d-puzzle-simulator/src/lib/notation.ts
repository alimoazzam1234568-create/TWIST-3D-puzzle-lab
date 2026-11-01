import type { AppliedMove, PuzzleDef } from "./engine/types";

export function formatMove(m: AppliedMove): string {
  if (m.pow === 2) return `${m.moveId}2`;
  return m.dir === -1 ? `${m.moveId}'` : m.moveId;
}

export function formatMoves(ms: AppliedMove[]): string {
  return ms.map(formatMove).join(" ");
}

export function inverseMoves(ms: AppliedMove[]): AppliedMove[] {
  const out: AppliedMove[] = [];
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i];
    out.push({ moveId: m.moveId, dir: m.dir === 1 ? -1 : 1, pow: m.pow ?? 1 });
  }
  return out;
}

/**
 * Parse human scramble input like "R U2 F' 3Rw2 u" into engine moves.
 * Throws with a readable message on invalid tokens.
 */
export function parseMoves(def: PuzzleDef, text: string): AppliedMove[] {
  const ids = new Set(def.moves.map((m) => m.id));
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const out: AppliedMove[] = [];
  for (const tok of tokens) {
    const match = tok.match(/^(\S+?)(2|2'|'|)$/);
    if (!match) throw new Error(`Cannot parse "${tok}"`);
    const [, core, suffix] = match;
    let id = core;
    // normalize wide notation: Rw, 2Rw, 3Rw are valid; also allow "2R" style
    if (!ids.has(id)) {
      const m2 = core.match(/^(\d+)([A-Za-z])(w?)$/);
      if (m2) {
        const w = parseInt(m2[1], 10);
        const cand = w <= 2 && m2[3] !== "w" ? `${m2[2]}w` : `${w}${m2[2]}w`;
        const cand2 = m2[3] === "w" && w === 2 ? `${m2[2]}w` : cand;
        if (ids.has(cand2)) id = cand2;
        else if (ids.has(cand)) id = cand;
      }
    }
    if (!ids.has(id)) throw new Error(`"${tok}" is not a legal move for ${def.name}`);
    if (suffix === "2" || suffix === "2'") out.push({ moveId: id, dir: 1, pow: 2 });
    else if (suffix === "'") out.push({ moveId: id, dir: -1, pow: 1 });
    else out.push({ moveId: id, dir: 1, pow: 1 });
  }
  return out;
}
