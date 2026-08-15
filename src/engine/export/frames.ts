/** Helpers to turn raw WebGL pixel buffers (bottom-up RGBA) into 2D canvas frames. */

export function createFrameCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function flipY(pixels: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * rowBytes;
    out.set(pixels.subarray(src, src + rowBytes), y * rowBytes);
  }
  return out;
}

export function drawPixels(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8Array,
  width: number,
  height: number,
  opaqueBackdrop?: string,
): ImageData {
  const data = new ImageData(flipY(pixels, width, height), width, height);
  ctx.clearRect(0, 0, width, height);
  if (opaqueBackdrop) {
    ctx.fillStyle = opaqueBackdrop;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.putImageData(data, 0, 0);
  return data;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), type);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
