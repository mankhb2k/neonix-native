import { syncScheduler, type Scheduler } from "../common/scheduler";
import type { PointerPos } from "../common/point";
import {
  defaultInteractionCoordinator,
  type InteractionCoordinator,
} from "./interaction-coordinator";

export type { PointerPos } from "../common/point";

export type SessionState = "idle" | "active" | "committed" | "cancelled";

export type PointerSessionConfig<TState, TResult> = {
  name: string;
  onStart?: (initialPos: PointerPos) => TState;
  onUpdate?: (pos: PointerPos, currentState: TState) => TState;
  onCommit?: (finalState: TState) => TResult;
  onCancel?: (lastState: TState) => void;
};

export type PointerSessionControllerOptions = {
  coordinator?: InteractionCoordinator;
  scheduler?: Scheduler;
};

/** @deprecated Dùng `coordinator.reset()` — giữ lại cho việc migrate test ở app. */
export function resetActivePointerSessionToken(
  coordinator: InteractionCoordinator = defaultInteractionCoordinator,
): void {
  coordinator.reset();
}

export class PointerSessionController<TState, TResult = void> {
  private config: PointerSessionConfig<TState, TResult>;
  private sessionToken: string;
  private state: SessionState = "idle";
  private currentState: TState | null = null;
  private rafId: number | null = null;
  private pendingPos: PointerPos | null = null;
  private coordinator: InteractionCoordinator;
  private scheduler: Scheduler;

  constructor(
    config: PointerSessionConfig<TState, TResult>,
    options?: PointerSessionControllerOptions,
  ) {
    this.config = config;
    this.coordinator = options?.coordinator ?? defaultInteractionCoordinator;
    this.scheduler = options?.scheduler ?? syncScheduler;
    this.sessionToken = `session_${config.name}_${Math.random().toString(36).slice(2, 9)}`;
  }

  public get isRunning(): boolean {
    return this.state === "active";
  }

  public get token(): string {
    return this.sessionToken;
  }

  public get currentSessionState(): TState | null {
    return this.currentState;
  }

  public flushPendingUpdate(): void {
    if (this.rafId !== null) {
      this.scheduler.cancelFrame(this.rafId);
      this.rafId = null;
    }
    if (this.pendingPos && this.state === "active" && this.config.onUpdate) {
      const pos = this.pendingPos;
      this.pendingPos = null;
      this.currentState = this.config.onUpdate(pos, this.currentState!);
    }
  }

  public start(initialPos: PointerPos): boolean {
    if (!this.coordinator.tryAcquire(this.sessionToken)) return false;
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
      this.rafId = this.scheduler.requestFrame(() => {
        this.rafId = null;
        if (
          this.pendingPos &&
          this.state === "active" &&
          this.config.onUpdate
        ) {
          const next = this.pendingPos;
          this.pendingPos = null;
          this.currentState = this.config.onUpdate(next, this.currentState!);
        }
      });
    }
  }

  public commit(): TResult | null {
    if (this.state !== "active") return null;
    // Áp dụng nốt pending update trước khi commit, để host không bắt buộc phải
    // gọi `flushPendingUpdate()` thủ công. Host vẫn có thể gọi trước — việc này
    // trở nên vô hại vì `flushPendingUpdate()` không áp dụng gì khi đã hết pending.
    this.flushPendingUpdate();
    this.state = "committed";
    this.releaseSessionToken();
    if (this.config.onCommit && this.currentState !== null) {
      return this.config.onCommit(this.currentState);
    }
    return null;
  }

  public cancel(): void {
    if (this.state !== "active") return;
    this.cancelScheduledFrame();
    this.state = "cancelled";
    this.releaseSessionToken();
    if (this.config.onCancel && this.currentState !== null) {
      this.config.onCancel(this.currentState);
    }
  }

  private cancelScheduledFrame(): void {
    if (this.rafId !== null) {
      this.scheduler.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  private releaseSessionToken(): void {
    this.coordinator.release(this.sessionToken);
  }
}
