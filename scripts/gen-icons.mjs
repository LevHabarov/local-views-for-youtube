// Draws the extension icon (a replay arrow around a play triangle) and writes
// PNGs in the sizes Chrome needs. Run with `npm run icons`; outputs are committed.
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;
const BACKGROUND = [37, 99, 235]; // blue-600
const FOREGROUND = [255, 255, 255];

// Shapes in normalized coordinates: (0, 0) is the top-left corner, y points down.
function insideRoundedRect(x, y) {
  const margin = 0.04;
  const radius = 0.22;
  const cx = Math.min(Math.max(x, margin + radius), 1 - margin - radius);
  const cy = Math.min(Math.max(y, margin + radius), 1 - margin - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insideTriangle(x, y, [a, b, c]) {
  const side = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = side(a, b);
  const d2 = side(b, c);
  const d3 = side(c, a);
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
}

function insideArc(x, y) {
  const distance = Math.hypot(x - 0.5, y - 0.5);
  if (Math.abs(distance - 0.3) > 0.045) return false;
  // Leave a gap clockwise from 12 o'clock for the arrowhead.
  const angle = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI;
  return !(angle > -90 && angle < -35);
}

const ARROWHEAD = [[0.62, 0.2], [0.48, 0.08], [0.48, 0.32]];
const PLAY = [[0.43, 0.37], [0.43, 0.63], [0.64, 0.5]];

function pixel(x, y) {
  if (!insideRoundedRect(x, y)) return null;
  const isForeground = insideArc(x, y) || insideTriangle(x, y, ARROWHEAD) || insideTriangle(x, y, PLAY);
  return isForeground ? FOREGROUND : BACKGROUND;
}

function render(size) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4); // Leading 0: no PNG row filter.
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, coverage = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const color = pixel((px + (sx + 0.5) / SUPERSAMPLE) / size, (py + (sy + 0.5) / SUPERSAMPLE) / size);
          if (!color) continue;
          r += color[0]; g += color[1]; b += color[2]; coverage++;
        }
      }
      const offset = 1 + px * 4;
      if (coverage > 0) {
        row[offset] = Math.round(r / coverage);
        row[offset + 1] = Math.round(g / coverage);
        row[offset + 2] = Math.round(b / coverage);
        row[offset + 3] = Math.round((255 * coverage) / SUPERSAMPLE ** 2);
      }
    }
    rows.push(row);
  }
  return encodePng(size, Buffer.concat(rows));
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bit depth.
  header[9] = 6; // RGBA.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of SIZES) {
  writeFileSync(`public/icons/icon${size}.png`, render(size));
}
console.log(`Wrote icons: ${SIZES.join(', ')} px`);
