import type { AppliedMove, PieceKind, Vec3 } from "../engine/types";

/** minimal serializable piece snapshot for the worker */
export interface PieceSnap {
  id: number;
  kind: PieceKind;
  pos: Vec3;
  ori: number[];
  stickers: { n: Vec3; c: number }[];
}

export type SolverRequest =
  | { t: "init" }
  | {
      t: "solve";
      seq: number;
      solver: "kociemba" | "pocket" | "pyra" | "reverse";
      pieces: PieceSnap[];
      /** history for the rewind solver */
      history?: AppliedMove[];
    };

export type SolverResponse =
  | { t: "ready"; phases: string[] }
  | {
      t: "solved";
      seq: number;
      moves: AppliedMove[];
      alg: string;
      detail: string;
      optimal: boolean;
    }
  | { t: "error"; seq: number; message: string };
