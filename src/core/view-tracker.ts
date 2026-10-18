// Decides when playback counts as a view. Pure logic, no browser APIs.
//
// Rules:
// - A view counts once the video has actually played for the threshold
//   (seeking does not add time): a number of seconds, or a share of the
//   video's length. In seconds mode, videos shorter than the threshold count
//   when nearly all of them has played.
// - Each playback session counts at most once. A new session starts when a
//   different video (or the same video loaded anew) plays, after the video
//   ends (replay), and when it jumps from the end back to the start (loop).

export interface ThresholdRule {
  mode: 'seconds' | 'percent';
  seconds: number;
  percent: number;
}

export const DEFAULT_THRESHOLD: ThresholdRule = { mode: 'seconds', seconds: 5, percent: 30 };

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

  /** `threshold` is read on every update, so a settings change applies right away. */
  constructor(
    private readonly onView: () => void,
    private readonly threshold: () => ThresholdRule = () => DEFAULT_THRESHOLD,
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
    const { mode, seconds, percent } = this.threshold();
    // Without a known length a share cannot be computed; use the seconds instead.
    if (mode === 'percent' && duration > 0) return (duration * percent) / 100;
    if (duration > 0 && duration < seconds) return duration * SHORT_VIDEO_SHARE;
    return seconds;
  }
}
