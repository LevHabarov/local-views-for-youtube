// Decides when playback counts as a view. Pure logic, no browser APIs.
//
// Rules:
// - A view counts once the video has actually played for `thresholdSec`
//   (seeking does not add time). Videos shorter than that count when nearly
//   all of them has played.
// - Each playback session counts at most once. A new session starts when a
//   different video (or the same video loaded anew) plays, after the video
//   ends (replay), and when it jumps from the end back to the start (loop).

export const DEFAULT_THRESHOLD_SEC = 5;

/** Largest gap between two time updates still treated as continuous playback. */
const MAX_TICK_SEC = 3;
/** How close to the end the previous position must be for a jump to the start to be a loop. */
const LOOP_END_SEC = 1.5;
/** How close to the start the new position must be for a jump to be a loop. */
const LOOP_START_SEC = 1;
/** Share of a short video that must play when it is shorter than the threshold. */
const SHORT_VIDEO_SHARE = 0.9;

export interface PlaybackState {
  /** Identifies one load of a video in the player; a new value means a new session. */
  sessionKey: string;
  currentTime: number;
  duration: number;
}

export class ViewTracker {
  private sessionKey: string | null = null;
  private lastTime: number | null = null;
  private watchedSec = 0;
  private counted = false;

  constructor(
    private readonly onView: () => void,
    private readonly thresholdSec = DEFAULT_THRESHOLD_SEC,
  ) {}

  timeUpdate(state: PlaybackState): void {
    this.switchSession(state.sessionKey);

    if (this.lastTime !== null) {
      const delta = state.currentTime - this.lastTime;
      if (delta > 0 && delta <= MAX_TICK_SEC) {
        this.watchedSec += delta;
      } else if (this.isLoop(this.lastTime, state)) {
        this.restartSession();
      }
    }
    this.lastTime = state.currentTime;

    if (!this.counted && this.watchedSec >= this.requiredSec(state.duration)) {
      this.counted = true;
      this.onView();
    }
  }

  /** `state.currentTime` is the seek target. */
  seeking(state: PlaybackState): void {
    this.switchSession(state.sessionKey);
    if (this.lastTime !== null && this.isLoop(this.lastTime, state)) {
      this.restartSession();
    }
    this.lastTime = null;
  }

  ended(state: PlaybackState): void {
    this.switchSession(state.sessionKey);
    this.restartSession();
  }

  /** Playback paused or interrupted (e.g. by an ad): the next update must not add the gap. */
  interrupt(): void {
    this.lastTime = null;
  }

  private switchSession(sessionKey: string): void {
    if (sessionKey !== this.sessionKey) {
      this.sessionKey = sessionKey;
      this.restartSession();
    }
  }

  private restartSession(): void {
    this.lastTime = null;
    this.watchedSec = 0;
    this.counted = false;
  }

  private isLoop(previousTime: number, state: PlaybackState): boolean {
    return (
      state.duration > 0 &&
      previousTime >= state.duration - LOOP_END_SEC &&
      state.currentTime <= LOOP_START_SEC
    );
  }

  private requiredSec(duration: number): number {
    if (duration > 0 && duration < this.thresholdSec) {
      return duration * SHORT_VIDEO_SHARE;
    }
    return this.thresholdSec;
  }
}
