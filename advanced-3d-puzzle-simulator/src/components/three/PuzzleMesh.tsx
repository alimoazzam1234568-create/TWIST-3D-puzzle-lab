import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { engine, easeTurn } from "../../lib/engine/engine";
import type { Piece, Sticker } from "../../lib/engine/types";
import { sfx } from "../../lib/sound";

// ---------------------------------------------------------------------------
// local sticker transforms (baked once per sticker)
// ---------------------------------------------------------------------------
function stickerQuat(s: Sticker): THREE.Quaternion {
  const n = new THREE.Vector3(s.n[0], s.n[1], s.n[2]).normalize();
  if (s.triUp) {
    const x = new THREE.Vector3(...s.triUp).normalize();
    const z = n.clone();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    const m = new THREE.Matrix4().makeBasis(x, y, z);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
}

interface GeomSet {
  body: Record<string, THREE.BufferGeometry>;
  sticker: Record<"square" | "tri", THREE.BufferGeometry>;
  bodyMat: THREE.Material;
  fillerMat: THREE.Material;
  stickerMats: THREE.MeshStandardMaterial[];
}

function makeGeoms(palette: string[]): GeomSet | null {
  const def = engine.def;
  if (!def) return null;
  const pieces = def.pieces;
  const isTetra = def.family === "pyraminx";
  const sizes = {
    box: pieces.find((p) => p.shape === "box")?.renderSize ?? 0.9,
    tetra: pieces.find((p) => p.shape === "tetra")?.renderSize ?? 0.3,
    diamond: pieces.find((p) => p.shape === "diamond")?.renderSize ?? 0.3,
  };
  const body: Record<string, THREE.BufferGeometry> = {
    box: new RoundedBoxGeometry(sizes.box, sizes.box, sizes.box, 3, sizes.box * 0.09),
    tetra: new THREE.TetrahedronGeometry(sizes.tetra),
    diamond: new THREE.OctahedronGeometry(sizes.diamond),
  };
  const sqSize = (3 / Math.max(def.order, 2)) * 0.8;
  const sticker: GeomSet["sticker"] = {
    square: new THREE.PlaneGeometry(sqSize, sqSize),
    tri: new THREE.CircleGeometry(0.36, 3),
  };
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isTetra ? "#151a26" : "#10141f",
    roughness: 0.38,
    metalness: 0.1,
  });
  const fillerMat = new THREE.MeshStandardMaterial({
    color: "#0b0e17",
    roughness: 0.55,
    metalness: 0.05,
  });
  const stickerMats = palette.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.22,
        metalness: 0.05,
        emissive: c,
        emissiveIntensity: 0.05,
      }),
  );
  return { body, sticker, bodyMat, fillerMat, stickerMats };
}

// ---------------------------------------------------------------------------
// gesture state
// ---------------------------------------------------------------------------
interface DragState {
  pieceId: number;
  normal: THREE.Vector3;
  point: THREE.Vector3;
  sx: number;
  sy: number;
  fired: boolean;
}

export function PuzzlePieces({
  palette,
  onDrag,
}: {
  palette: string[];
  onDrag: (dragging: boolean) => void;
}) {
  const version = useSyncExternalStore(engine.subscribe, engine.getVersion);
  const def = engine.def;
  const geom = useMemo(() => makeGeoms(palette), [version, palette]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupRefs = useRef(new Map<number, THREE.Group>());
  const drag = useRef<DragState | null>(null);
  const { camera, gl } = useThree();

  const pieces = engine.pieces;
  const worldScale = def?.worldScale ?? 1;

  // ---- matrix helpers ------------------------------------------------------
  const tmpMat = useRef(new THREE.Matrix4());
  const tmpQuat = useRef(new THREE.Quaternion());

  const setMatrix = (p: Piece, animMat: THREE.Matrix4 | null) => {
    const g = groupRefs.current.get(p.id);
    if (!g) return;
    const o = p.ori;
    const m = new THREE.Matrix4().set(
      o[0], o[1], o[2], 0,
      o[3], o[4], o[5], 0,
      o[6], o[7], o[8], 0,
      0, 0, 0, 1,
    );
    const pos = new THREE.Vector3(
      p.pos[0] * worldScale,
      p.pos[1] * worldScale,
      p.pos[2] * worldScale,
    );
    if (animMat) {
      const m2 = animMat.clone().multiply(m);
      pos.applyMatrix4(animMat);
      m2.setPosition(pos);
      g.matrix.copy(m2);
    } else {
      m.setPosition(pos);
      g.matrix.copy(m);
    }
    g.matrixWorldNeedsUpdate = true;
  };

  // after state commits -> refresh everything (layout effect: no flicker)
  useLayoutEffect(() => {
    for (const p of engine.pieces) setMatrix(p, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // ---- per-frame animation pump --------------------------------------------
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    engine.tick(dt);
    const a = engine.anim;
    if (a) {
      const ax = new THREE.Vector3(...a.move.axis).normalize();
      const ang = ((a.move.angle * a.dir * a.pow * Math.PI) / 180) * easeTurn(Math.min(a.t, 1));
      const am = tmpMat.current.makeRotationAxis(ax, ang);
      for (const pid of a.pieceSet) {
        const p = engine.pieces[pid];
        if (p) setMatrix(p, am);
      }
    }
  });

  // ---- drag-to-turn ----------------------------------------------------------
  const onPointerDown = (e: ThreeEvent<PointerEvent>, p: Piece, stickerN?: THREE.Vector3) => {
    if (engine.autoSolving && engine.queue.length > 0) return;
    if (!def) return;
    e.stopPropagation();
    const normal =
      stickerN ??
      new THREE.Vector3(0, 1, 0);
    drag.current = {
      pieceId: p.id,
      normal,
      point: e.point.clone(),
      sx: (e.nativeEvent.clientX / window.innerWidth) * 2 - 1,
      sy: -(e.nativeEvent.clientY / window.innerHeight) * 2 + 1,
      fired: false,
    };
    onDrag(true);

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || d.fired || !engine.def) return;
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const dxPx = ev.clientX - (rect.left + ((d.sx + 1) / 2) * rect.width);
      const dyPx = ev.clientY - (rect.top + ((1 - d.sy) / 2) * rect.height);
      if (Math.hypot(dxPx, dyPx) < 16) return;

      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(d.normal, d.point);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const delta = hit.clone().sub(d.point);
      if (delta.length() < 0.05) return;

      // candidate moves containing this piece (resolved against CURRENT state),
      // with axis roughly perpendicular to the dragged face.
      // Pyraminx tip twists are excluded from dragging (grab the whole vertex).
      const family = engine.def.family;
      const cand = engine.def.moves
        .map((m) => {
          if (family === "pyraminx" && /^[urlb]$/.test(m.id)) return null;
          const ids = m.select(engine.pieces);
          if (!ids.includes(d.pieceId)) return null;
          const ax = new THREE.Vector3(...m.axis).normalize();
          const v = new THREE.Vector3().crossVectors(ax, d.point);
          const score = delta.dot(v);
          return { m, ax, score, ortho: Math.abs(ax.dot(d.normal)), count: ids.length };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null && c.ortho < 0.6);
      if (!cand.length) return;
      // group by axis line: keep fewest-piece move per line (outermost layer)
      const byLine = new Map<string, (typeof cand)[number]>();
      for (const c of cand) {
        const key = c.ax
          .toArray()
          .map((x) => Math.abs(x))
          .join(",");
        const prev = byLine.get(key);
        if (!prev || c.count < prev.count) byLine.set(key, c);
      }
      let best: typeof cand[number] | null = null;
      for (const c of byLine.values()) if (!best || Math.abs(c.score) > Math.abs(best.score)) best = c;
      if (!best || Math.abs(best.score) < 0.02) return;
      const s = Math.sign(best.score) || 1;
      const dir = (s * Math.sign(best.m.angle)) as 1 | -1;
      d.fired = true;
      sfx.move();
      engine.apply({ moveId: best.m.id, dir, pow: 1 });
      window.removeEventListener("pointermove", onMove);
    };
    const onUp = () => {
      drag.current = null;
      onDrag(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!def || !geom) return null;

  return (
    <group quaternion={familyTilt(def.family)}>
      {pieces.map((p) => (
        <group
          key={p.id}
          matrixAutoUpdate={false}
          ref={(g) => {
            if (g) groupRefs.current.set(p.id, g);
            else groupRefs.current.delete(p.id);
          }}
        >
          <mesh
            geometry={geom.body[p.shape]}
            material={p.kind === "filler" ? geom.fillerMat : geom.bodyMat}
            castShadow
            receiveShadow
            onPointerDown={(e) => {
              if (p.stickers.length === 0) return;
              const n = p.stickers[0];
              const wn = new THREE.Vector3(...n.n).applyQuaternion(
                tmpQuat.current.setFromRotationMatrix(
                  tmpMat.current.set(
                    p.ori[0], p.ori[1], p.ori[2], 0,
                    p.ori[3], p.ori[4], p.ori[5], 0,
                    p.ori[6], p.ori[7], p.ori[8], 0,
                    0, 0, 0, 1,
                  ),
                ),
              );
              onPointerDown(e, p, wn.normalize());
            }}
          />
          {p.stickers.map((s, i) => {
            const oriM = new THREE.Matrix4().set(
              p.ori[0], p.ori[1], p.ori[2], 0,
              p.ori[3], p.ori[4], p.ori[5], 0,
              p.ori[6], p.ori[7], p.ori[8], 0,
              0, 0, 0, 1,
            );
            const wn = new THREE.Vector3(s.n[0], s.n[1], s.n[2])
              .applyMatrix4(oriM)
              .normalize();
            return (
              <mesh
                key={i}
                geometry={s.triUp ? geom.sticker.tri : geom.sticker.square}
                material={geom.stickerMats[s.c]}
                position={[s.off[0] * 1.01, s.off[1] * 1.01, s.off[2] * 1.01]}
                quaternion={stickerQuat(s)}
                onPointerDown={(e) => onPointerDown(e, p, wn)}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** tilt quaternion so the pyraminx stands on a face with a vertex up */
export function familyTilt(family: string): [number, number, number, number] {
  if (family !== "pyraminx") return [0, 0, 0, 1];
  const q1 = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(0, 1, 0),
  );
  // face 1 normal (-1,1,1) after q1 -> rotate about Y to face the camera
  const n = new THREE.Vector3(-1, 1, 1).normalize().applyQuaternion(q1);
  const phi = Math.atan2(n.x, n.z);
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -phi);
  const q = q2.multiply(q1);
  return [q.x, q.y, q.z, q.w];
}
