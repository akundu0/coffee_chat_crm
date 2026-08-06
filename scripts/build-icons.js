/**
 * build-icons.js
 *
 * Generates the extension's toolbar icons (16/48/128px PNG) at build
 * time instead of committing binary image files. Draws a simple
 * rounded-square "coffee cup handle" mark in the extension's teal
 * brand color using pngjs, with no external asset dependencies.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const TEAL = { r: 0x2e, g: 0x7d, b: 0x6b };
const PAPER = { r: 0xf1, g: 0xef, b: 0xe9 };

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.47;
  const cupR = size * 0.3;
  const handleOuterR = size * 0.16;
  const handleInnerR = size * 0.085;
  const handleCx = cx + size * 0.2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      const dxOuter = x - cx;
      const dyOuter = y - cy;
      const inCircle = Math.sqrt(dxOuter * dxOuter + dyOuter * dyOuter) <= outerR;

      let color = null;
      if (inCircle) {
        color = TEAL;
        // Cup body: a paper-colored rounded rect left-of-center.
        const cupLeft = cx - cupR;
        const cupRight = cx + size * 0.02;
        const cupTop = cy - cupR * 0.85;
        const cupBottom = cy + cupR * 0.85;
        if (x >= cupLeft && x <= cupRight && y >= cupTop && y <= cupBottom) {
          color = PAPER;
        }
        // Handle: a ring to the right of the cup.
        const dxH = x - handleCx;
        const dyH = y - cy;
        const distH = Math.sqrt(dxH * dxH + dyH * dyH);
        if (distH <= handleOuterR && distH >= handleInnerR && x >= cx) {
          color = PAPER;
        }
      }

      if (color) {
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }
  return png;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

[16, 48, 128].forEach((size) => {
  const png = drawIcon(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  png.pack().pipe(fs.createWriteStream(outPath));
  console.log(`Wrote ${outPath}`);
});
