import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function png(width, height, draw) {
  const pixels = Buffer.alloc(width * height * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3] ?? 255;
  };
  const rect = (x, y, w, h, color) => {
    for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy += 1) {
      for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx += 1) set(xx, yy, color);
    }
  };
  draw({ width, height, set, rect });

  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0;
    pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon({ width, height, rect }) {
  const unit = Math.round(width / 32);
  const dark = [45, 36, 56, 255];
  const ink = [23, 19, 33, 255];
  const gold = [255, 191, 71, 255];
  const pale = [255, 250, 240, 255];
  const green = [60, 163, 112, 255];
  rect(0, 0, width, height, dark);

  for (let i = -32; i < 64; i += 4) {
    rect(i * unit, 0, unit, height, [67, 51, 82, 255]);
    rect(0, i * unit, width, unit, [67, 51, 82, 255]);
  }

  rect(7 * unit, 7 * unit, 18 * unit, 18 * unit, ink);
  rect(6 * unit, 6 * unit, 18 * unit, 18 * unit, gold);
  rect(8 * unit, 8 * unit, 14 * unit, 14 * unit, [255, 213, 102, 255]);
  rect(10 * unit, 11 * unit, 10 * unit, 2 * unit, pale);
  rect(10 * unit, 15 * unit, 10 * unit, 2 * unit, pale);
  rect(10 * unit, 19 * unit, 10 * unit, 2 * unit, pale);
  rect(8 * unit, 24 * unit, 6 * unit, 2 * unit, green);
  rect(16 * unit, 24 * unit, 8 * unit, 2 * unit, green);
}

function drawSplash({ width, height, rect }) {
  rect(0, 0, width, height, [249, 243, 223, 255]);
  const step = Math.round(width / 28);
  for (let x = 0; x < width; x += step) rect(x, 0, 3, height, [232, 219, 184, 255]);
  for (let y = 0; y < height; y += step) rect(0, y, width, 3, [232, 219, 184, 255]);
  const logoSize = Math.round(width * 0.38);
  const x = Math.round((width - logoSize) / 2);
  const y = Math.round((height - logoSize) / 2);
  const scale = logoSize / 32;
  const localRect = (rx, ry, rw, rh, color) => rect(Math.round(x + rx * scale), Math.round(y + ry * scale), Math.round(rw * scale), Math.round(rh * scale), color);
  drawIcon({ width: logoSize, height: logoSize, rect: localRect });
}

function writePng(path, width, height, draw) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(width, height, draw));
  console.log(path);
}

writePng('public/icon-192.png', 192, 192, drawIcon);
writePng('public/icon-512.png', 512, 512, drawIcon);
writePng('public/apple-touch-icon.png', 180, 180, drawIcon);

if (existsSync('ios/App/App/Assets.xcassets')) {
  writePng('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, drawIcon);
  writePng('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', 2732, 2732, drawSplash);
  writePng('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', 2732, 2732, drawSplash);
  writePng('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', 2732, 2732, drawSplash);
}

if (existsSync('android/app/src/main/res')) {
  const densities = [
    ['mdpi', 48, 108, 320, 480],
    ['hdpi', 72, 162, 480, 800],
    ['xhdpi', 96, 216, 720, 1280],
    ['xxhdpi', 144, 324, 960, 1600],
    ['xxxhdpi', 192, 432, 1280, 1920]
  ];

  for (const [density, iconSize, foregroundSize, shortSide, longSide] of densities) {
    const mipmap = `android/app/src/main/res/mipmap-${density}`;
    writePng(`${mipmap}/ic_launcher.png`, iconSize, iconSize, drawIcon);
    writePng(`${mipmap}/ic_launcher_round.png`, iconSize, iconSize, drawIcon);
    writePng(`${mipmap}/ic_launcher_foreground.png`, foregroundSize, foregroundSize, drawIcon);
    writePng(`android/app/src/main/res/drawable-port-${density}/splash.png`, shortSide, longSide, drawSplash);
    writePng(`android/app/src/main/res/drawable-land-${density}/splash.png`, longSide, shortSide, drawSplash);
  }

  writePng('android/app/src/main/res/drawable/splash.png', 480, 320, drawSplash);
}
