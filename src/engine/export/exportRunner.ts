import type { Engine } from "@/engine/Engine";
import type { ExportSettings, Project } from "@/domain/types";
import { GifEncoder } from "./gif";
import { ZipWriter } from "./zip";
import { startWebmRecorder } from "./webm";
import { canvasToBlob, createFrameCanvas, downloadBlob, drawPixels } from "./frames";

export interface ExportProgress {
  phase: string;
  current: number;
  total: number;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "matter-field";

/**
 * Deterministic exporter. Frame timing comes from the frame index and the loop
 * duration, so the same project always yields the same sequence.
 */
export async function runExport(
  engine: Engine,
  project: Project,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
  shouldCancel: () => boolean,
): Promise<void> {
  const fps = settings.fps;
  const width = Math.floor(settings.width / 2) * 2;
  const height = Math.floor(settings.height / 2) * 2;
  const duration = settings.duration > 0 ? settings.duration : project.loop.duration;
  const frameCount = Math.max(1, Math.round(duration * fps));
  const name = slug(project.name);
  const transparent = settings.transparent && settings.format !== "webm";

  if (settings.format === "still") {
    const canvas = createFrameCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    onProgress({ phase: "Rendering still", current: 0, total: 1 });
    await engine.renderSequence(
      width,
      height,
      fps,
      1,
      (pixels) => {
        drawPixels(ctx, pixels, width, height);
      },
      () => {},
      shouldCancel,
      transparent,
    );
    downloadBlob(await canvasToBlob(canvas), `${name}.png`);
    onProgress({ phase: "Done", current: 1, total: 1 });
    return;
  }

  if (settings.format === "png") {
    const canvas = createFrameCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const zip = new ZipWriter();
    await engine.renderSequence(
      width,
      height,
      fps,
      frameCount,
      async (pixels, index) => {
        drawPixels(ctx, pixels, width, height);
        const blob = await canvasToBlob(canvas);
        const buffer = new Uint8Array(await blob.arrayBuffer());
        zip.add(`${name}_${String(index).padStart(4, "0")}.png`, buffer);
      },
      (current, total) => onProgress({ phase: "Encoding PNG frames", current, total }),
      shouldCancel,
      transparent,
    );
    onProgress({ phase: "Packaging archive", current: frameCount, total: frameCount });
    downloadBlob(zip.finish(), `${name}_png_sequence.zip`);
    return;
  }

  if (settings.format === "gif") {
    const scale = Math.min(1, 640 / Math.max(width, height));
    const gw = Math.max(2, Math.floor(width * scale));
    const gh = Math.max(2, Math.floor(height * scale));
    const canvas = createFrameCanvas(gw, gh);
    const ctx = canvas.getContext("2d")!;
    const gifFps = Math.min(fps, 25);
    const gifFrames = Math.max(1, Math.round(duration * gifFps));
    const encoder = new GifEncoder(gw, gh, Math.max(2, Math.round(100 / gifFps)));
    await engine.renderSequence(
      gw,
      gh,
      gifFps,
      gifFrames,
      (pixels) => {
        const data = drawPixels(ctx, pixels, gw, gh, "#05070a");
        encoder.addFrame(data.data as unknown as Uint8ClampedArray);
      },
      (current, total) => onProgress({ phase: "Encoding GIF", current, total }),
      shouldCancel,
      false,
    );
    onProgress({ phase: "Writing GIF", current: gifFrames, total: gifFrames });
    downloadBlob(encoder.finish(), `${name}.gif`);
    return;
  }

  // WebM
  const canvas = createFrameCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const recorder = startWebmRecorder(canvas, fps, settings.bitrateMbps * 1_000_000);
  const frameInterval = 1000 / fps;
  await engine.renderSequence(
    width,
    height,
    fps,
    frameCount,
    async (pixels) => {
      drawPixels(ctx, pixels, width, height, "#05070a");
      recorder.frame();
      await new Promise((r) => setTimeout(r, frameInterval));
    },
    (current, total) => onProgress({ phase: "Recording WebM", current, total }),
    shouldCancel,
    false,
  );
  onProgress({ phase: "Finalizing video", current: frameCount, total: frameCount });
  downloadBlob(await recorder.finish(), `${name}.webm`);
}
