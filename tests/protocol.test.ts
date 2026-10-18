import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, parseMediaMessage, type MediaMessage } from '../src/shared/protocol';

const valid: MediaMessage = {
  type: 'timeupdate',
  videoId: 'jNQXAC9IVRw',
  playbackId: '6fDI0hBFoGzB7KnU',
  title: 'Me at the zoo',
  channel: 'jawed',
  currentTime: 2.05,
  duration: 19.02,
  isAd: false,
};

const parse = (message: unknown) => parseMediaMessage(JSON.stringify(message));

describe('parseMediaMessage', () => {
  it('accepts a well-formed message', () => {
    expect(parse(valid)).toEqual(valid);
  });

  it('rejects anything that is not a JSON object string', () => {
    expect(parseMediaMessage(valid)).toBeNull();
    expect(parseMediaMessage('not json')).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parse([valid])).toBeNull();
  });

  it('rejects malformed video IDs', () => {
    for (const videoId of ['', 'short', 'jNQXAC9IVRw1', 'jNQXAC9IV/w', 'video:abc12', 42]) {
      expect(parse({ ...valid, videoId })).toBeNull();
    }
  });

  it('rejects unknown event types', () => {
    expect(parse({ ...valid, type: 'play' })).toBeNull();
  });

  it('rejects times that are not finite non-negative numbers', () => {
    expect(parse({ ...valid, currentTime: '5' })).toBeNull();
    expect(parse({ ...valid, currentTime: -1 })).toBeNull();
    expect(parse({ ...valid, duration: null })).toBeNull();
  });

  it('rejects wrong field types', () => {
    expect(parse({ ...valid, isAd: 'false' })).toBeNull();
    expect(parse({ ...valid, title: 5 })).toBeNull();
    expect(parse({ ...valid, playbackId: undefined })).toBeNull();
  });

  it('caps the title and channel length', () => {
    const long = 'x'.repeat(MAX_TEXT_LENGTH + 100);
    const message = parse({ ...valid, title: long, channel: long });
    expect(message?.title).toHaveLength(MAX_TEXT_LENGTH);
    expect(message?.channel).toHaveLength(MAX_TEXT_LENGTH);
  });

  it('drops unknown fields', () => {
    expect(parse({ ...valid, extra: 'x' })).toEqual(valid);
  });
});
