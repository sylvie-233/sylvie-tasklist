/**
 * 生成应用图标（不依赖任何图形库）：
 * - assets/icon.png  256×256，用于窗口 / 托盘 / 打包
 * - assets/icon.ico  PNG-in-ICO 容器，用于 Windows 安装包
 *
 * 图形：圆角方块 + 蓝色渐变 + 白色对勾（与任务清单的语义一致）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');

const SIZE = 256;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const RADIUS = SIZE * 0.22;

function insideRoundedSquare(x, y) {
  const pad = SIZE * 0.04;
  const min = pad;
  const max = SIZE - pad;
  if (x < min || x > max || y < min || y > max) {
    return false;
  }
  const nearestX = Math.min(Math.max(x, min + RADIUS), max - RADIUS);
  const nearestY = Math.min(Math.max(y, min + RADIUS), max - RADIUS);
  if (x === nearestX || y === nearestY) {
    return true;
  }
  return Math.hypot(x - nearestX, y - nearestY) <= RADIUS;
}

function sampleColor(x, y) {
  if (!insideRoundedSquare(x, y)) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  // 竖向渐变：#3b82f6 → #1d4ed8
  const t = y / SIZE;
  const r = Math.round(59 + (29 - 59) * t);
  const g = Math.round(130 + (78 - 130) * t);
  const b = Math.round(246 + (216 - 246) * t);

  const stroke = SIZE * 0.075;
  const d1 = distanceToSegment(x, y, SIZE * 0.29, SIZE * 0.52, SIZE * 0.44, SIZE * 0.67);
  const d2 = distanceToSegment(x, y, SIZE * 0.44, SIZE * 0.67, SIZE * 0.72, SIZE * 0.36);
  if (Math.min(d1, d2) <= stroke / 2) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }
  return { r, g, b, a: 255 };
}

function renderIcon(size) {
  const scale = size / SIZE;
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + 0.5) / samples) / scale;
          const py = (y + (sy + 0.5) / samples) / scale;
          const color = sampleColor(px, py);
          rr += color.r * color.a;
          gg += color.g * color.a;
          bb += color.b * color.a;
          aa += color.a;
        }
      }
      const total = samples * samples;
      const offset = (y * size + x) * 4;
      if (aa === 0) {
        rgba[offset + 3] = 0;
        continue;
      }
      rgba[offset] = Math.round(rr / aa);
      rgba[offset + 1] = Math.round(gg / aa);
      rgba[offset + 2] = Math.round(bb / aa);
      rgba[offset + 3] = Math.round(aa / total);
    }
  }
  return encodePng(size, size, rgba);
}

function wrapIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256
  entry[1] = 0; // height 256
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset

  return Buffer.concat([header, entry, png]);
}

mkdirSync(assetsDir, { recursive: true });
const png256 = renderIcon(SIZE);
writeFileSync(path.join(assetsDir, 'icon.png'), png256);
writeFileSync(path.join(assetsDir, 'icon.ico'), wrapIco(png256));
writeFileSync(path.join(assetsDir, 'tray.png'), renderIcon(32));

console.log(`图标已生成：${path.join(assetsDir, 'icon.png')} / icon.ico / tray.png`);
