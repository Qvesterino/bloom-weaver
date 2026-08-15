import type { Gradient } from "@/domain/types";
import { uid } from "@/domain/id";

export interface PalettePreset {
  id: string;
  name: string;
  background: string;
  gradients: [string[], string[], string[]];
}

const g = (name: string, colors: string[]): Gradient => ({
  id: uid("grad"),
  name,
  interpolation: "oklch",
  stops: colors.map((color, i) => ({
    id: uid("stop"),
    position: colors.length === 1 ? 0 : i / (colors.length - 1),
    color,
    opacity: 1,
  })),
});

export function makeGradient(name: string, colors: string[]): Gradient {
  return g(name, colors);
}

export const PALETTES: PalettePreset[] = [
  {
    id: "nebula-cyan",
    name: "Nebula Cyan",
    background: "#04080f",
    gradients: [
      ["#04141f", "#00c8d8", "#ffd0cf", "#fff8df"],
      ["#062033", "#2f8fff", "#b6f2ff"],
      ["#03080e", "#0d4d63", "#7fd8e8"],
    ],
  },
  {
    id: "deep-space",
    name: "Deep Space",
    background: "#03040a",
    gradients: [
      ["#05060f", "#1c3fa8", "#8fb4ff", "#f4f7ff"],
      ["#070a18", "#3d5bd9", "#cfe0ff"],
      ["#02030a", "#141f4d", "#5a6fb5"],
    ],
  },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    background: "#07030d",
    gradients: [
      ["#12042a", "#7a1cff", "#ff5cc8", "#ffe6f6"],
      ["#1c0640", "#b13cff", "#ffc4f0"],
      ["#0a0218", "#3d0f6b", "#8b4cd9"],
    ],
  },
  {
    id: "petri",
    name: "Petri Cyan / Pink",
    background: "#050b0d",
    gradients: [
      ["#04191c", "#17d7c3", "#ff8fc4", "#fff2f6"],
      ["#062226", "#3ff0d8", "#ffd2e6"],
      ["#031012", "#0d5f5c", "#63c9b8"],
    ],
  },
  {
    id: "bioluminescent",
    name: "Bioluminescent",
    background: "#010a0b",
    gradients: [
      ["#001417", "#0affd0", "#a6ffe6", "#ffffff"],
      ["#001a1c", "#26f0a3", "#d8ffe9"],
      ["#000b0c", "#04635a", "#37b39c"],
    ],
  },
  {
    id: "toxic-culture",
    name: "Toxic Culture",
    background: "#060a03",
    gradients: [
      ["#0b1503", "#7ee619", "#e6ff6b", "#fbffe0"],
      ["#111a04", "#b6f53c", "#f2ffb0"],
      ["#050a02", "#375c0d", "#8bab3a"],
    ],
  },
  {
    id: "stellar-gold",
    name: "Stellar Gold",
    background: "#0a0603",
    gradients: [
      ["#1a0d02", "#ff9c1a", "#ffe08a", "#fff9ec"],
      ["#230f02", "#ffbb47", "#fff0c4"],
      ["#0d0601", "#5c3208", "#b5813a"],
    ],
  },
  {
    id: "monochrome-ice",
    name: "Monochrome Ice",
    background: "#05070a",
    gradients: [
      ["#0a0f14", "#5f7c8c", "#c8dbe6", "#ffffff"],
      ["#0d141a", "#8aa6b5", "#e6f2f7"],
      ["#05080b", "#26353d", "#69818c"],
    ],
  },
  {
    id: "coral-fluorescence",
    name: "Coral Fluorescence",
    background: "#0b0407",
    gradients: [
      ["#1c0410", "#ff2e6b", "#ffb35c", "#fff2d9"],
      ["#25060f", "#ff5c8a", "#ffd9b0"],
      ["#0d0207", "#6b0f2a", "#c44a63"],
    ],
  },
];

export function paletteGradients(preset: PalettePreset): [Gradient, Gradient, Gradient] {
  return [
    g("Core", preset.gradients[0]),
    g("Matter", preset.gradients[1]),
    g("Haze", preset.gradients[2]),
  ];
}
