declare module "cubejs" {
  interface CubeState {
    cp: number[];
    co: number[];
    ep: number[];
    eo: number[];
    center: number[];
  }
  export default class Cube {
    constructor(other?: CubeState | Cube);
    static initSolver(): void;
    static scramble(): string;
    static inverse(alg: string): string;
    static fromString(s: string): Cube;
    init(state: CubeState): void;
    identity(): void;
    toJSON(): CubeState;
    asString(): string;
    clone(): Cube;
    isSolved(): boolean;
    move(alg: string | number): this;
    randomize(): this;
    solve(): string;
    upright(): string;
    solveUpright(maxDepth?: number): string;
  }
}
