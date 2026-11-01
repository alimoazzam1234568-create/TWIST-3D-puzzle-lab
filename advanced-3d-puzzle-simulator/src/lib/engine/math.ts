import type { Mat3, Vec3 } from "./types";

export const V3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  neg: (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]],
  eq: (a: Vec3, b: Vec3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
  key: (a: Vec3): string => `${a[0]},${a[1]},${a[2]}`,
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
};

export const M3 = {
  IDENTITY: [1, 0, 0, 0, 1, 0, 0, 0, 1] as Mat3,
  mulVec(m: Mat3, v: Vec3): Vec3 {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  },
  mul(a: Mat3, b: Mat3): Mat3 {
    const r = new Array(9).fill(0);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
    return r;
  },
  transpose(m: Mat3): Mat3 {
    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  },
};

/**
 * Exact rotation matrix about an integer axis by an angle that is a multiple
 * of 60/90 degrees. Uses Rodrigues' formula with snapping to integers, which
 * is exact for 90° turns about coordinate axes and 120° turns about the
 * body diagonals (±1,±1,±1) used by tetrahedral puzzles.
 */
export function rotFromAxisAngle(axis: Vec3, angleDeg: number): Mat3 {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const k = [axis[0] / len, axis[1] / len, axis[2] / len];
  const t = (angleDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const C = 1 - c;
  const r: Mat3 = [
    k[0] * k[0] * C + c,
    k[0] * k[1] * C - k[2] * s,
    k[0] * k[2] * C + k[1] * s,
    k[1] * k[0] * C + k[2] * s,
    k[1] * k[1] * C + c,
    k[1] * k[2] * C - k[0] * s,
    k[2] * k[0] * C - k[1] * s,
    k[2] * k[1] * C + k[0] * s,
    k[2] * k[2] * C + c,
  ];
  return r.map((x) => Math.round(x));
}

/** All 24 proper rotations of the cube (signed permutation matrices, det=+1) */
export function cubeRotationGroup(): Mat3[] {
  const out: Mat3[] = [];
  const perms: [number, number, number][] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
      const m: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      // row i picks axis p[i] with sign sg[i]
      for (let i = 0; i < 3; i++) m[i * 3 + p[i]] = sg[i];
      const det =
        m[0] * (m[4] * m[8] - m[5] * m[7]) -
        m[1] * (m[3] * m[8] - m[5] * m[6]) +
        m[2] * (m[3] * m[7] - m[4] * m[6]);
      if (det === 1) out.push(m);
    }
  }
  return out;
}

export const CUBE_ROTATIONS = cubeRotationGroup();
