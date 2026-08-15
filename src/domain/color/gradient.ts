import type { Gradient, GradientStop, Interpolation } from "@/domain/types";

export const LUT_WIDTH = 256;

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/* ---------------------------------------------------------------- srgb/oklab */

const srgbToLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const linearToSrgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;

function rgbToOklab([r, g, b]: RGB): RGB {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, bb]: RGB): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function rgbToHsl([r, g, b]: RGB): RGB {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]: RGB): RGB {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mixHue(a: number, b: number, t: number) {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  let h = a + d * t;
  if (h < 0) h += 1;
  if (h > 1) h -= 1;
  return h;
}

export function mixColors(a: string, b: string, t: number, mode: Interpolation): RGB {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (mode === "rgb") {
    return [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)];
  }
  if (mode === "hsl") {
    const ha = rgbToHsl(ca);
    const hb = rgbToHsl(cb);
    return hslToRgb([
      mixHue(ha[0], hb[0], t),
      lerp(ha[1], hb[1], t),
      lerp(ha[2], hb[2], t),
    ]);
  }
  const oa = rgbToOklab(ca);
  const ob = rgbToOklab(cb);
  return oklabToRgb([
    lerp(oa[0], ob[0], t),
    lerp(oa[1], ob[1], t),
    lerp(oa[2], ob[2], t),
  ]);
}

export function sortedStops(gradient: Gradient): GradientStop[] {
  return [...gradient.stops].sort((x, y) => x.position - y.position);
}

/** Evaluate a gradient at t in [0,1] returning premultiply-ready rgba (0..1). */
export function sampleGradient(gradient: Gradient, t: number): [number, number, number, number] {
  const stops = sortedStops(gradient);
  const first = stops[0];
  if (!first) return [0, 0, 0, 0];
  const last = stops[stops.length - 1]!;
  const asRgba = (stop: GradientStop): [number, number, number, number] => {
    const c = hexToRgb(stop.color);
    return [c[0], c[1], c[2], stop.opacity];
  };
  if (stops.length === 1) return asRgba(first);
  const x = Math.max(0, Math.min(1, t));
  if (x <= first.position) return asRgba(first);
  if (x >= last.position) return asRgba(last);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (x >= a.position && x <= b.position) {
      const span = b.position - a.position;
      const local = span <= 1e-6 ? 0 : (x - a.position) / span;
      const c = mixColors(a.color, b.color, local, gradient.interpolation);
      return [c[0], c[1], c[2], lerp(a.opacity, b.opacity, local)];
    }
  }
  return asRgba(last);
}


/** 256x1 RGBA8 lookup table consumed by the renderer. */
export function gradientToLUT(gradient: Gradient): Uint8Array {
  const data = new Uint8Array(LUT_WIDTH * 4);
  for (let i = 0; i < LUT_WIDTH; i++) {
    const [r, g, b, a] = sampleGradient(gradient, i / (LUT_WIDTH - 1));
    data[i * 4 + 0] = Math.round(Math.max(0, Math.min(1, r)) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  return data;
}

/** CSS preview string for editor UI. */
export function gradientToCss(gradient: Gradient, steps = 24): string {
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [r, g, b, a] = sampleGradient(gradient, t);
    parts.push(
      `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(3)}) ${(t * 100).toFixed(1)}%`,
    );
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

export function reverseGradient(gradient: Gradient): Gradient {
  return {
    ...gradient,
    stops: gradient.stops.map((s) => ({ ...s, position: 1 - s.position })),
  };
}
