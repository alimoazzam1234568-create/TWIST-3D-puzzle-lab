import { useEffect } from "react";
import { GameScreen } from "./GameScreen";
import { useApp } from "../store";

export function SolverView() {
  const setMode = useApp((s) => s.setMode);
  useEffect(() => setMode("auto"), [setMode]);
  return <GameScreen layout="solver" />;
}
