/* Generates a small demo bitmap font (samples/demo.png + samples/demo.fnt) so the
   project can be tried and tested without any third-party artwork.
   Usage: node tools/make-demo-font.js */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"],
  "-": ["000", "000", "111", "000", "000"],
  "+": ["000", "010", "111", "010", "000"]
};
const PIXEL = 8, PAD = 3, COLS = 5;
const CW = 3 * PIXEL + 2 * PAD, CH = 5 * PIXEL + 2 * PAD; // glyph cell size
const GAP = 2;
const keys = Object.keys(GLYPHS);
const rows = Math.ceil(keys.length / COLS);
const W = COLS * (CW + GAP) + GAP, H = rows * (CH + GAP) + GAP;

const rgba = Buffer.alloc(W * H * 4); // transparent
function put(x, y, r, g, b, a) {
  const i = (y * W + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}

const chars = [];
keys.forEach((k, n) => {
  const ox = GAP + (n % COLS) * (CW + GAP), oy = GAP + Math.floor(n / COLS) * (CH + GAP);
  const on = Array.from({ length: CH }, () => new Array(CW).fill(false));
  GLYPHS[k].forEach((row, ry) => [...row].forEach((c, rx) => {
    if (c !== "1") return;
    for (let y = 0; y < PIXEL; y++) for (let x = 0; x < PIXEL; x++) on[PAD + ry * PIXEL + y][PAD + rx * PIXEL + x] = true;
  }));
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (on[y][x]) {
      const t = (y - PAD) / (5 * PIXEL); // vertical gradient: yellow -> orange
      put(ox + x, oy + y, 255, Math.round(210 - 90 * t), 40, 255);
    } else {
      // dark outline around lit pixels
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (on[y + dy] && on[y + dy][x + dx]) { near = true; break; }
      }
      if (near) put(ox + x, oy + y, 90, 20, 10, 255);
    }
  }
  chars.push({ id: k.charCodeAt(0), x: ox, y: oy });
});

// --- minimal PNG encoder ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
]);

// --- .fnt (BMFont text format) ---
const advance = CW - 2 * PAD + 6;
const lines = [
  `info face="demo" size=40 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=0,0 outline=0`,
  `common lineHeight=${CH + 8} base=${CH} scaleW=${W} scaleH=${H} pages=1 packed=0 alphaChnl=0 redChnl=0 greenChnl=0 blueChnl=0`,
  `page id=0 file="demo.png"`,
  `chars count=${chars.length + 1}`,
  `char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=14 page=0 chnl=15`,
  ...chars.map((c) => `char id=${c.id} x=${c.x} y=${c.y} width=${CW} height=${CH} xoffset=0 yoffset=4 xadvance=${advance} page=0 chnl=15`),
  `kernings count=0`
];

const out = path.join(__dirname, "..", "samples");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "demo.png"), png);
fs.writeFileSync(path.join(out, "demo.fnt"), lines.join("\n") + "\n");
console.log(`demo.png ${W}x${H}, ${chars.length} glyphs, xadvance ${advance}`);
