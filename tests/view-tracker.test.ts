import { describe, expect, it } from 'vitest';
import { ViewTracker, type PlaybackState } from '../src/core/view-tracker';

function setup(duration = 60) {
  let views = 0;
  const tracker = new ViewTracker(() => views++);
  const state = (currentTime: number, sessionKey = 'a:1'): PlaybackState => ({
    sessionKey,
    currentTime,
    duration,
  });
  /** Plays from `from` to `to` with 0.25 s time updates, like the browser does. */
  const play = (from: number, to: number, sessionKey = 'a:1') => {
    for (let t = from; t <= to + 1e-9; t += 0.25) tracker.timeUpdate(state(t, sessionKey));
  };
  return { tracker, state, play, views: () => views };
}

describe('ViewTracker', () => {
  it('counts a view after 5 seconds of playback', () => {
    const { play, views } = setup();
    play(0, 4.75);
    expect(views()).toBe(0);
    play(5, 5);
    expect(views()).toBe(1);
  });

  it('counts each session only once', () => {
    const { play, views } = setup();
    play(0, 40);
    expect(views()).toBe(1);
  });

  it('does not count seeking as watched time', () => {
    const { tracker, state, play, views } = setup();
    play(0, 2);
    tracker.seeking(state(30));
    play(30, 32);
    expect(views()).toBe(0);
    play(32.25, 33);
    expect(views()).toBe(1);
  });

  it('ignores time jumps without a seeking event', () => {
    const { play, views } = setup();
    play(0, 2);
    play(30, 32);
    expect(views()).toBe(0);
  });

  it('does not count paused time', () => {
    const { tracker, play, views } = setup();
    play(0, 3);
    tracker.interrupt();
    play(3, 4);
    expect(views()).toBe(0);
  });

  it('counts a replay after the video ended', () => {
    const { tracker, state, play, views } = setup(20);
    play(0, 20);
    tracker.ended(state(20));
    tracker.seeking(state(0));
    play(0, 5);
    expect(views()).toBe(2);
  });

  it('counts each loop as a new view', () => {
    const { tracker, state, play, views } = setup(20);
    play(0, 19.75);
    tracker.seeking(state(0)); // The loop attribute seeks back to the start.
    play(0, 5);
    expect(views()).toBe(2);
  });

  it('counts a loop even when no seeking event arrives', () => {
    const { play, views } = setup(20);
    play(0, 19.75);
    play(0, 5);
    expect(views()).toBe(2);
  });

  it('does not treat a manual seek to the start mid-video as a loop', () => {
    const { tracker, state, play, views } = setup(60);
    play(0, 30);
    tracker.seeking(state(0));
    play(0, 10);
    expect(views()).toBe(1);
  });

  it('starts a new session when another video plays', () => {
    const { play, views } = setup();
    play(0, 3, 'a:1');
    play(0, 3, 'b:1');
    expect(views()).toBe(0);
    play(3.25, 5, 'b:1');
    expect(views()).toBe(1);
  });

  it('starts a new session when the same video is loaded again', () => {
    const { play, views } = setup();
    play(0, 10, 'a:1');
    play(0, 5, 'a:2');
    expect(views()).toBe(2);
  });

  it('counts videos shorter than the threshold when nearly all of them played', () => {
    const { play, views } = setup(3);
    play(0, 2.5);
    expect(views()).toBe(0);
    play(2.75, 2.75);
    expect(views()).toBe(1);
  });
});
