/**
 * Self-contained animated GIF89a encoder.
 * Uses a fixed 6x6x6 web-safe cube plus a grayscale ramp, with 4x4 ordered
 * dithering so smooth glows band far less than plain quantization.
 */

const LEVELS = 6;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function buildPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < LEVELS; r++)
    for (let g = 0; g < LEVELS; g++)
      for (let b = 0; b < LEVELS; b++) {
        palette[i++] = Math.round((r / (LEVELS - 1)) * 255);
        palette[i++] = Math.round((g / (LEVELS - 1)) * 255);
        palette[i++] = Math.round((b / (LEVELS - 1)) * 255);
      }
  // remaining 40 slots: fine grayscale ramp for dark gradients
  for (let s = 0; s < 40; s++) {
    const v = Math.round((s / 39) * 255);
    palette[i++] = v;
    palette[i++] = v;
    palette[i++] = v;
  }
  return palette;
}

const PALETTE = buildPalette();

function quantize(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const bias = (BAYER[y & 3]![x & 3]! / 16 - 0.5) * (255 / (LEVELS - 1)) * 0.9;
      const r = rgba[p]! + bias;
      const g = rgba[p + 1]! + bias;
      const b = rgba[p + 2]! + bias;
      const isGray = Math.abs(r - g) < 6 && Math.abs(g - b) < 6;
      if (isGray) {
        const s = Math.max(0, Math.min(39, Math.round((r / 255) * 39)));
        out[y * width + x] = 216 + s;
      } else {
        const qr = Math.max(0, Math.min(LEVELS - 1, Math.round((r / 255) * (LEVELS - 1))));
        const qg = Math.max(0, Math.min(LEVELS - 1, Math.round((g / 255) * (LEVELS - 1))));
        const qb = Math.max(0, Math.min(LEVELS - 1, Math.round((b / 255) * (LEVELS - 1))));
        out[y * width + x] = qr * LEVELS * LEVELS + qg * LEVELS + qb;
      }
    }
  }
  return out;
}

class BitWriter {
  bytes: number[] = [];
  private cur = 0;
  private bits = 0;

  write(code: number, length: number): void {
    this.cur |= code << this.bits;
    this.bits += length;
    while (this.bits >= 8) {
      this.bytes.push(this.cur & 0xff);
      this.cur >>= 8;
      this.bits -= 8;
    }
  }

  flush(): void {
    if (this.bits > 0) {
      this.bytes.push(this.cur & 0xff);
      this.cur = 0;
      this.bits = 0;
    }
  }
}

function lzwEncode(indices: Uint8Array, minCodeSize = 8): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<string, number>();
  const writer = new BitWriter();

  const reset = () => {
    dict = new Map();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  writer.write(clearCode, codeSize);
  reset();

  let prefix = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const combined = `${prefix},${k}`;
    if (dict.has(combined)) {
      prefix = combined;
      continue;
    }
    writer.write(prefix.includes(",") ? dict.get(prefix)! : Number(prefix), codeSize);
    dict.set(combined, nextCode++);
    if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    if (nextCode >= 4096) {
      writer.write(clearCode, codeSize);
      reset();
    }
    prefix = String(k);
  }
  writer.write(prefix.includes(",") ? dict.get(prefix)! : Number(prefix), codeSize);
  writer.write(eoiCode, codeSize);
  writer.flush();
  return writer.bytes;
}

export class GifEncoder {
  private chunks: number[][] = [];
  private started = false;

  constructor(
    private width: number,
    private height: number,
    private delayCentis: number,
  ) {}

  private header(): void {
    const bytes: number[] = [];
    "GIF89a".split("").forEach((c) => bytes.push(c.charCodeAt(0)));
    bytes.push(this.width & 0xff, (this.width >> 8) & 0xff);
    bytes.push(this.height & 0xff, (this.height >> 8) & 0xff);
    bytes.push(0xf7, 0, 0); // global color table, 256 entries
    for (let i = 0; i < 768; i++) bytes.push(PALETTE[i]!);
    // Netscape looping extension
    bytes.push(0x21, 0xff, 0x0b);
    "NETSCAPE2.0".split("").forEach((c) => bytes.push(c.charCodeAt(0)));
    bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);
    this.chunks.push(bytes);
    this.started = true;
  }

  addFrame(rgba: Uint8ClampedArray): void {
    if (!this.started) this.header();
    const bytes: number[] = [];
    bytes.push(0x21, 0xf9, 0x04, 0x04);
    bytes.push(this.delayCentis & 0xff, (this.delayCentis >> 8) & 0xff);
    bytes.push(0x00, 0x00);
    bytes.push(0x2c, 0, 0, 0, 0);
    bytes.push(this.width & 0xff, (this.width >> 8) & 0xff);
    bytes.push(this.height & 0xff, (this.height >> 8) & 0xff);
    bytes.push(0x00);
    bytes.push(0x08);
    const data = lzwEncode(quantize(rgba, this.width, this.height));
    for (let i = 0; i < data.length; i += 255) {
      const block = data.slice(i, i + 255);
      bytes.push(block.length, ...block);
    }
    bytes.push(0x00);
    this.chunks.push(bytes);
  }

  finish(): Blob {
    if (!this.started) this.header();
    this.chunks.push([0x3b]);
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    this.chunks.forEach((c) => {
      out.set(c, offset);
      offset += c.length;
    });
    return new Blob([out], { type: "image/gif" });
  }
}
