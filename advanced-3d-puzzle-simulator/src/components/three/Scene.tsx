import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PuzzlePieces } from "./PuzzleMesh";
import { useApp } from "../../store";

export type CameraPreset = "iso" | "front" | "top" | "right" | "back";

type CameraAPI = { view: (p: CameraPreset) => void };
export const cameraAPI: CameraAPI = { view: () => {} };

// Front-dominant default so the puzzle sits dead-center of the stage.
const PRESETS: Record<CameraPreset, [number, number, number]> = {
  iso: [1.5, 1.0, 5.1],
  front: [0, 0.25, 6.0],
  top: [0.02, 5.8, 0.02],
  right: [5.8, 0.25, 0],
  back: [0, 0.5, -6.0],
};
const TARGET: [number, number, number] = [0, -0.05, 0];

export function GameScene({
  palette,
  className,
  interactive = true,
}: {
  palette: string[];
  className?: string;
  interactive?: boolean;
}) {
  const quality = useApp((s) => s.settings.quality);
  const autoRotate = useApp((s) => s.settings.cameraAutoRotate);
  const theme = useApp((s) => s.settings.theme);
  const controls = useRef<OrbitControlsImpl>(null);
  const [dragging, setDragging] = useState(false);

  cameraAPI.view = (p) => {
    const c = controls.current;
    if (!c) return;
    const [x, y, z] = PRESETS[p];
    c.object.position.set(x, y, z);
    c.target.set(...TARGET);
    c.update();
  };

  return (
    // No inline style here — the "absolute inset-0" class must win so the
    // canvas fills the whole stage panel and the puzzle is truly centered.
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        shadows={quality === "high"}
        dpr={[1, 2]}
        camera={{ position: PRESETS.iso, fov: 38, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={theme === "dark" ? 0.5 : 0.75} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.5}
          castShadow={quality === "high"}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <directionalLight position={[-6, 3, -5]} intensity={0.35} color="#8b5cf6" />
        <pointLight position={[-4, -2, 4]} intensity={12} color="#38bdf8" distance={14} />
        <PuzzlePieces palette={palette} onDrag={setDragging} />
        <ContactShadows
          position={[0, -2.55, 0]}
          opacity={theme === "dark" ? 0.55 : 0.3}
          scale={12}
          blur={2.6}
          far={4}
          color="#000000"
        />
        <OrbitControls
          ref={controls}
          makeDefault
          target={TARGET}
          enabled={interactive && !dragging}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.6}
          maxDistance={12}
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.7}
        />
      </Canvas>
    </div>
  );
}
