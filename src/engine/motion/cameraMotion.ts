import * as THREE from "three";
import type { CameraObject } from "@/domain/types";

const TAU = Math.PI * 2;

function periodicNoise(phase: number, seed: number): number {
  const a = Math.sin(phase * TAU + seed);
  const b = Math.sin(phase * TAU * 2 + seed * 1.7) * 0.5;
  const c = Math.sin(phase * TAU * 3 + seed * 3.1) * 0.25;
  return (a + b + c) / 1.75;
}

export interface CameraMotionResult {
  offset: THREE.Vector3;
  roll: number;
  distanceScale: number;
}

const offset = new THREE.Vector3();

/**
 * Loop-safe procedural camera motion. Everything derives from normalized phase,
 * so a full cycle always returns to its starting pose.
 */
export function evaluateCameraMotion(
  camera: CameraObject,
  phase01: number,
  cycles = 1,
): CameraMotionResult {
  const m = camera.config.motion;
  const p = (phase01 * Math.max(1, Math.round(cycles)) + m.phase) % 1;
  const smooth = 1 - Math.min(0.95, m.smoothness) * 0;
  offset.set(0, 0, 0);
  let roll = 0;
  let distanceScale = 1;

  switch (m.type) {
    case "orbit": {
      const angle = p * TAU;
      offset.set(
        Math.sin(angle) * m.radius * 0.35,
        Math.sin(angle * 1) * m.elevation * m.radius * 0.5,
        Math.cos(angle) * m.radius * 0.35 - m.radius * 0.35,
      );
      break;
    }
    case "pushIn": {
      const eased = 0.5 - Math.cos(p * TAU) * 0.5;
      distanceScale = 1 - eased * 0.35 * m.amount;
      break;
    }
    case "pullOut": {
      const eased = 0.5 - Math.cos(p * TAU) * 0.5;
      distanceScale = 1 + eased * 0.45 * m.amount;
      break;
    }
    case "drift": {
      offset.set(
        periodicNoise(p, 1.3) * m.amount,
        periodicNoise(p, 4.7) * m.amount * 0.6,
        periodicNoise(p, 9.1) * m.amount * 0.8,
      );
      break;
    }
    case "roll": {
      roll = Math.sin(p * TAU) * m.amount * 0.5;
      break;
    }
    case "noise": {
      offset.set(
        periodicNoise(p * 2, 2.1) * m.amount * 1.4,
        periodicNoise(p * 2, 5.3) * m.amount * 1.4,
        periodicNoise(p * 2, 8.9) * m.amount,
      );
      roll = periodicNoise(p, 11.4) * m.amount * 0.1;
      break;
    }
    default:
      break;
  }

  offset.multiplyScalar(smooth * (m.type === "orbit" ? 1 : Math.max(0.2, 1 - m.smoothness * 0.3)));
  return { offset: offset.clone(), roll, distanceScale };
}
