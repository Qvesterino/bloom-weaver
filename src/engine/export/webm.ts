/** WebM (VP9/VP8) recording from a canvas fed one deterministic frame at a time. */

export function pickWebmMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export interface WebmRecorder {
  frame: () => void;
  finish: () => Promise<Blob>;
}

export function startWebmRecorder(
  canvas: HTMLCanvasElement,
  fps: number,
  bitrate: number,
): WebmRecorder {
  const mime = pickWebmMime();
  if (!mime) throw new Error("This browser cannot record WebM video. Export a PNG sequence instead.");
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  return {
    frame: () => track.requestFrame?.(),
    finish: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mime }));
        };
        recorder.stop();
      }),
  };
}
