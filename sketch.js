// ASCII zoom with morphing portraits + OSU “O”: O filled with symbols; outside shows large cycling words. Names are rarer than words; “YOU” appears occasionally but larger.

let asciiChars = "@#MW8BNX&%$0OHnxsSEC+*=\\/|()[]{}-:;,'\"` .";

let playing = true;
let frameHold = 14;
let holdCounter = 0;

let baseBlock = 10;
let maxBlock = 160;
let increments = [2, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
let baseDwellSteps = 30;

let sequence = [];
let seqIndex = 0;

const gamma = 0.95;
const contrast = 1.4;
const minAlpha = 90;
const maxAlpha = 255;
const invert = false;

let w = 1200, h = 1157;
let glyphTable = [];

let IMAGES = [
  'assets/ayannahoward.jpg',
  'assets/CynthiaClopper.jpg',
  'assets/GaetaneVerna.jpg',
  'assets/lizSanders.jpg',
  'assets/mariaPalazzi.jpg',
  'assets/SoledadFernandez.jpg',
  'assets/osu_O.png'
];

let imgs = [];
let lumIntegrals = [];
let currentImageIndex = 0;
let logoIndex = IMAGES.length - 1;

const NAMES_FIRST = ["AYANNA","CYNTHIA","GAËTANE","LIZ","MARIA","SOLEDAD"];
const NAMES_LAST  = ["HOWARD","CLOPPER","VERNA","SANDERS","PALAZZI","FERNÁNDEZ"];
const TERMS = [
  "WOMEN","IMPACT","ACADEMIA","RESEARCH","MENTOR","SCHOLAR","EQUITY","LEADERSHIP","INNOVATION",
  "TEACHING","LEARNING","PROFESSOR","ARTIST","ENGINEER","SCIENTIST","ACTIVIST","COMMUNITY",
  "OSU","INSPIRE","VISION","KNOWLEDGE","DISCOVERY","CREATE","CULTURE","HISTORY","FUTURE",
  "INCLUSION","STEM","HUMANITIES","JUSTICE","VOICE","AGENCY","PROGRESS","EXCELLENCE","ACCESS",
  "SERVICE","COLLABORATION","EMPOWER","CURIOSITY","BREAKTHROUGH","ROLE MODEL","TRAILBLAZER"
];
const NAME_SET = new Set([...NAMES_FIRST, ...NAMES_LAST]);
const TERM_SET = new Set(TERMS);

let logoThreshold = 200;
let logoBlock = 8;
let wordCycleSteps = 12;

let logoMask = null;
let logoCols = 0;
let logoRows = 0;

function preload() {
  for (let i = 0; i < IMAGES.length; i++) imgs[i] = loadImage(IMAGES[i]);
}

function setup() {
  createCanvas(w, h);
  textFont('monospace');
  textAlign(CENTER, CENTER);
  background(228, 218, 209);
  glyphTable = Array.from(asciiChars);

  for (let i = 0; i < imgs.length; i++) {
    imgs[i].resize(w, h);
    imgs[i].loadPixels();
    lumIntegrals[i] = buildIntegralLuminance(imgs[i]);
  }

  buildSizeSequence();
  buildLogoMask();
  frameRate(60);
}

function draw() {
  if (!playing) return;
  if (holdCounter++ < frameHold) return;
  holdCounter = 0;

  const blockSize = sequence[seqIndex];
  const U = upLength();
  const D = downLength();
  let morphT = 0;
  let nextIndex = (currentImageIndex + 1) % imgs.length;

  if (seqIndex >= U) {
    const k = seqIndex - U;
    morphT = D <= 1 ? 1 : k / (D - 1);
  }

  if (currentImageIndex === logoIndex) {
    renderLogoOutsideWords(logoBlock, Math.floor(seqIndex / wordCycleSteps));
  } else {
    renderAsciiBlend(blockSize, currentImageIndex, nextIndex, morphT);
  }

  seqIndex = (seqIndex + 1) % sequence.length;
  if (seqIndex === 0) currentImageIndex = (currentImageIndex + 1) % imgs.length;
}

function renderAsciiBlend(blockSize, idxA, idxB, t) {
  background(228, 218, 209);
  blendMode(BLEND);
  noStroke();
  textSize(blockSize * 1.6);
  const IA = lumIntegrals[idxA];
  const IB = lumIntegrals[idxB];

  for (let y = 0; y < h; y += blockSize) {
    for (let x = 0; x < w; x += blockSize) {
      const x2 = min(x + blockSize, w), y2 = min(y + blockSize, h);
      const avgA = avgLumRectFrom(IA, x, y, x2, y2);
      const avgB = avgLumRectFrom(IB, x, y, x2, y2);
      const avgL = avgA * (1 - t) + avgB * t;

      let n = avgL / 255.0;
      n = pow(n, gamma);
      n = (n - 0.5) * contrast + 0.5;
      n = constrain(n, 0, 1);
      const adj = n * 255;

      let idxChar = map(adj, 0, 255, 0, asciiChars.length - 1);
      if (invert) idxChar = asciiChars.length - 1 - idxChar;
      idxChar = floor(constrain(idxChar, 0, asciiChars.length - 1));
      const glyph = glyphTable[idxChar];

      const a = map(adj, 0, 255, maxAlpha, minAlpha);
      fill(35, 6, 3, a);
      text(glyph, x + (x2 - x) / 2, y + (y2 - y) / 2);
    }
  }
}

function renderLogoOutsideWords(blockSize, phase) {
  background(228, 218, 209);
  blendMode(BLEND);
  noStroke();

  const IL = lumIntegrals[logoIndex];
  const cols = logoCols;
  const rows = logoRows;
  const occ = Array.from({ length: cols }, () => new Array(rows).fill(false));

  const bigBoxes = [
    {cw: 18, ch: 6},
    {cw: 16, ch: 6},
    {cw: 14, ch: 5},
    {cw: 12, ch: 4},
    {cw: 10, ch: 4}
  ];

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      if (logoMask[bx][by] || occ[bx][by]) continue;

      const chooser = hash3(bx, by, phase) % 10;
      const tryBig = chooser < 8;

      if (tryBig) {
        for (let s = 0; s < bigBoxes.length; s++) {
          const cw = bigBoxes[s].cw, ch = bigBoxes[s].ch;
          if (bx + cw > cols || by + ch > rows) continue;

          let fits = true;
          for (let yy = by; yy < by + ch && fits; yy++) {
            for (let xx = bx; xx < bx + cw; xx++) {
              if (occ[xx][yy] || logoMask[xx][yy]) { fits = false; break; }
            }
          }
          if (!fits) continue;

          const px = bx * blockSize, py = by * blockSize;
          const pw = cw * blockSize, ph = ch * blockSize;
          const word = pickWordWeighted(px, py, phase);
          const size = fitTextSize(word, pw * 0.9, ph * 0.85) * sizeBonus(word);
          textSize(size);
          fill(35, 6, 3, 245);
          text(word, px + pw / 2, py + ph / 2);

          for (let yy = by; yy < by + ch; yy++) for (let xx = bx; xx < bx + cw; xx++) occ[xx][yy] = true;
          break;
        }
      }
    }
  }

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const x = bx * blockSize, y = by * blockSize;
      const x2 = min(x + blockSize, w), y2 = min(y + blockSize, h);
      const L = avgLumRectFrom(IL, x, y, x2, y2);

      if (logoMask[bx][by]) {
        let n = L / 255.0;
        n = pow(n, gamma);
        n = (n - 0.5) * contrast + 0.5;
        n = constrain(n, 0, 1);
        const adj = n * 255;
        const a = map(adj, 0, 255, maxAlpha, minAlpha);
        fill(35, 6, 3, a);
        textSize(blockSize * 1.6);
        const idxChar = floor(constrain(map(adj, 0, 255, 0, asciiChars.length - 1), 0, asciiChars.length - 1));
        text(glyphTable[idxChar], x + (x2 - x) / 2, y + (y2 - y) / 2);
      } else if (!occ[bx][by]) {
        let n = L / 255.0;
        n = pow(n, gamma);
        n = (n - 0.5) * contrast + 0.5;
        n = constrain(n, 0, 1);
        const adj = n * 255;
        const a = map(adj, 0, 255, maxAlpha, minAlpha);
        fill(35, 6, 3, a);
        textSize(blockSize * 1.6);
        const idxChar = floor(constrain(map(adj, 0, 255, 0, asciiChars.length - 1), 0, asciiChars.length - 1));
        text(glyphTable[idxChar], x + (x2 - x) / 2, y + (y2 - y) / 2);
      }
    }
  }
}

function buildLogoMask() {
  logoCols = Math.ceil(w / logoBlock);
  logoRows = Math.ceil(h / logoBlock);
  const IL = lumIntegrals[logoIndex];
  const mask = Array.from({ length: logoCols }, () => new Array(logoRows).fill(false));

  for (let by = 0; by < logoRows; by++) {
    for (let bx = 0; bx < logoCols; bx++) {
      const x = bx * logoBlock, y = by * logoBlock;
      const x2 = min(x + logoBlock, w), y2 = min(y + logoBlock, h);
      const L = avgLumRectFrom(IL, x, y, x2, y2);
      mask[bx][by] = (L < logoThreshold);
    }
  }

  const dilated = Array.from({ length: logoCols }, () => new Array(logoRows).fill(false));
  for (let by = 0; by < logoRows; by++) {
    for (let bx = 0; bx < logoCols; bx++) {
      let any = false;
      for (let oy = -1; oy <= 1 && !any; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const xx = bx + ox, yy = by + oy;
          if (xx >= 0 && xx < logoCols && yy >= 0 && yy < logoRows) {
            if (mask[xx][yy]) { any = true; break; }
          }
        }
      }
      dilated[bx][by] = any;
    }
  }
  logoMask = dilated;
}

function pickWordWeighted(x, y, phase) {
  const r = (Math.abs(hash3(x, y, phase)) % 1000) / 1000;
  const youProb = 0.08;
  const namesProb = 0.15;
  if (r < youProb) return "YOU";
  if (r < youProb + namesProb) {
    const pickFirst = (hash3(y, x, phase + 7) & 1) === 0;
    const arr = pickFirst ? NAMES_FIRST : NAMES_LAST;
    return arr[Math.abs(hash3(x + 11, y + 19, phase)) % arr.length];
  }
  return TERMS[Math.abs(hash3(x + 23, y + 29, phase)) % TERMS.length];
}

function sizeBonus(word) {
  if (word === "YOU") return 1.35;
  if (NAME_SET.has(word)) return 1.12;
  if (TERM_SET.has(word)) return 1.0;
  return 1.0;
}

function hash3(a, b, c) {
  let h = 2166136261 >>> 0;
  h ^= a + 0x9e3779b9 + (h << 6) + (h >>> 2);
  h ^= b + 0x9e3779b9 + (h << 6) + (h >>> 2);
  h ^= c + 0x9e3779b9 + (h << 6) + (h >>> 2);
  return h | 0;
}

function fitTextSize(word, maxW, maxH) {
  const testSize = 100;
  textSize(testSize);
  let tw = textWidth(word);
  if (tw <= 0) tw = 1;
  const scaleW = (maxW * testSize) / tw;
  const scaleH = maxH;
  return min(scaleW, scaleH) * 0.95;
}

function buildIntegralLuminance(img) {
  const W = w + 1;
  const integral = new Float32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = (x + y * w) * 4;
      const r = img.pixels[idx], g = img.pixels[idx + 1], b = img.pixels[idx + 2];
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      rowSum += L;
      const above = integral[y * (w + 1) + (x + 1)];
      integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + above;
    }
  }
  return integral;
}

function sumRectFrom(integral, x1, y1, x2, y2) {
  const W = w + 1;
  const A = integral[y1 * W + x1];
  const B = integral[y1 * W + x2];
  const C = integral[y2 * W + x1];
  const D = integral[y2 * W + x2];
  return D - B - C + A;
}

function avgLumRectFrom(integral, x, y, x2, y2) {
  x = max(0, min(x, w)); y = max(0, min(y, h));
  x2 = max(0, min(x2, w)); y2 = max(0, min(y2, h));
  const area = max(1, (x2 - x) * (y2 - y));
  return sumRectFrom(integral, x, y, x2, y2) / area;
}

function buildSizeSequence() {
  let up = [], s = baseBlock;
  for (let i = 0; i < baseDwellSteps; i++) up.push(baseBlock);
  for (let inc of increments) {
    s += inc; up.push(s);
    if (s >= maxBlock) { up[up.length - 1] = maxBlock; break; }
  }
  const down = up.slice(baseDwellSteps, -1).reverse();
  sequence = up.concat(down);
}

function upLength() {
  let s = baseBlock, up = baseDwellSteps;
  for (let inc of increments) { s += inc; up++; if (s >= maxBlock) break; }
  return up;
}

function downLength() {
  const U = upLength();
  return sequence.length - U;
}

function keyPressed() {
  if (key === ' ') { playing = !playing; if (playing) loop(); else noLoop(); }
  else if (keyCode === UP_ARROW) { frameHold = max(1, frameHold - 1); }
  else if (keyCode === DOWN_ARROW) { frameHold = frameHold + 1; }
}

function mousePressed() {
  playing = !playing; if (playing) loop(); else noLoop();
}