export type PointerPos = {
  x: number;
  y: number;
};

export type SessionState = "idle" | "active" | "committed" | "cancelled";

export type PointerSessionConfig<TState, TResult> = {
  name: string;
  onStart?: (initialPos: PointerPos) => TState;
  onUpdate?: (pos: PointerPos, currentState: TState) => TState;
  onCommit?: (finalState: TState) => TResult;
  onCancel?: (lastState: TState) => void;
};

let activeSessionToken: string | null = null;

export class PointerSessionController<TState, TResult = void> {
  private config: PointerSessionConfig<TState, TResult>;
  private sessionToken: string;
  private state: SessionState = "idle";
  private currentState: TState | null = null;
  private rafId: number | null = null;
  private pendingPos: PointerPos | null = null;

  constructor(config: PointerSessionConfig<TState, TResult>) {
    this.config = config;
    this.sessionToken = `session_${config.name}_${Math.random().toString(36).slice(2, 9)}`;
  }

  public get isRunning(): boolean {
    return this.state === "active";
  }

  public get currentSessionState(): TState | null {
    return this.currentState;
  }

  public start(initialPos: PointerPos): boolean {
    if (activeSessionToken !== null) {
      return false; // Prevent concurrent interaction sessions
    }
    activeSessionToken = this.sessionToken;
    this.state = "active";
    this.currentState = this.config.onStart
      ? this.config.onStart(initialPos)
      : ({} as TState);

    return true;
  }

  public update(pos: PointerPos): void {
    if (this.state !== "active") return;
    this.pendingPos = pos;

    if (this.rafId === null) {
      if (typeof requestAnimationFrame !== "undefined") {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (this.pendingPos && this.state === "active" && this.config.onUpdate) {
            this.currentState = this.config.onUpdate(this.pendingPos, this.currentState!);
          }
        });
      } else if (this.config.onUpdate) {
        this.currentState = this.config.onUpdate(pos, this.currentState!);
      }
    }
  }

  public commit(): TResult | null {
    if (this.state !== "active") return null;
    this.cancelAnimationFrame();
    this.state = "committed";
    this.releaseSessionToken();

    let result: TResult | null = null;
    if (this.config.onCommit && this.currentState !== null) {
      result = this.config.onCommit(this.currentState);
    }
    return result;
  }

  public cancel(): void {
    if (this.state !== "active") return;
    this.cancelAnimationFrame();
    this.state = "cancelled";
    this.releaseSessionToken();

    if (this.config.onCancel && this.currentState !== null) {
      this.config.onCancel(this.currentState);
    }
  }

  private cancelAnimationFrame(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private releaseSessionToken(): void {
    if (activeSessionToken === this.sessionToken) {
      activeSessionToken = null;
    }
  }
}
