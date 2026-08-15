import { NOISE_GLSL } from "./noise.glsl";

export const MAX_FIELDS = 8;

/** Fullscreen pass-through vertex shader for GPGPU simulation passes. */
export const SIM_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Simulation fragment shader.
 * MRT output 0 = position (xyz) + normalized age (w)
 * MRT output 1 = velocity (xyz) + lifetime (w)
 */
export const SIM_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;

layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uDt;
uniform float uTime;
uniform float uPhase;        // normalized loop phase 0..1
uniform float uLoopFreq;     // 1 / loopDuration
uniform bool uInit;
uniform float uTexSize;
uniform int uCount;

// emitter
uniform vec3 uEmitPos;
uniform int uEmitShape;      // 0 point 1 sphere 2 shell 3 box 4 ring 5 disc
uniform float uEmitRadius;
uniform float uEmitThickness;
uniform float uEmitSeed;
uniform float uEmitVel;
uniform float uEmitVelVar;
uniform float uEmitSpread;
uniform int uSpawnMode;      // 0 static 1 burst 2 continuous

// matter
uniform float uDrag;
uniform float uLifetime;
uniform float uLifeVar;
uniform float uSeed;
uniform float uSeparation;
uniform float uMerge;
uniform float uClusterRadius;
uniform float uMutation;
uniform bool uPairwise;

// fields
uniform int uFieldCount;
uniform vec4 uFieldA[${MAX_FIELDS}];  // pos.xyz, kind
uniform vec4 uFieldB[${MAX_FIELDS}];  // radius, strength, falloff, frequency
uniform vec4 uFieldC[${MAX_FIELDS}];  // temporalSpeed, seed, twist, noiseDistortion
uniform vec4 uFieldD[${MAX_FIELDS}];  // pulse, dir.xyz
uniform vec4 uFieldE[${MAX_FIELDS}];  // octaves, unused

${NOISE_GLSL}

float falloffAt(float d, float radius, float power) {
  float x = clamp(1.0 - d / max(radius, 0.0001), 0.0, 1.0);
  return pow(x, max(power, 0.001));
}

vec3 spawnPosition(float id) {
  vec3 h = hash31(id * 1.371 + uEmitSeed * 0.917);
  vec3 h2 = hash31(id * 7.913 + uEmitSeed * 3.181 + 17.0);
  float theta = h.x * 6.2831853;
  float phi = acos(clamp(h.y * 2.0 - 1.0, -1.0, 1.0));
  vec3 dir = vec3(sin(phi) * cos(theta), sin(phi) * sin(theta), cos(phi));
  vec3 local = vec3(0.0);
  if (uEmitShape == 0) {
    local = vec3(0.0);
  } else if (uEmitShape == 1) {
    local = dir * uEmitRadius * pow(h.z, 0.3333);
  } else if (uEmitShape == 2) {
    local = dir * uEmitRadius * (1.0 + (h.z - 0.5) * uEmitThickness);
  } else if (uEmitShape == 3) {
    local = (h2 * 2.0 - 1.0) * uEmitRadius;
  } else if (uEmitShape == 4) {
    local = vec3(cos(theta), 0.0, sin(theta)) * uEmitRadius * (1.0 + (h.z - 0.5) * uEmitThickness);
    local.y += (h2.y - 0.5) * uEmitThickness * uEmitRadius;
  } else {
    float r = uEmitRadius * sqrt(h.z);
    local = vec3(cos(theta) * r, (h2.y - 0.5) * uEmitThickness * uEmitRadius, sin(theta) * r);
  }
  return uEmitPos + local;
}

vec3 spawnVelocity(float id, vec3 pos) {
  vec3 h = hash31(id * 3.117 + uEmitSeed * 1.77 + 91.0);
  vec3 radial = normalize(pos - uEmitPos + vec3(1e-4));
  vec3 rnd = normalize(h * 2.0 - 1.0 + vec3(1e-4));
  vec3 dir = normalize(mix(radial, rnd, clamp(uEmitSpread, 0.0, 1.0)));
  float speed = uEmitVel * (1.0 + (h.z - 0.5) * 2.0 * uEmitVelVar);
  return dir * speed;
}

vec3 fieldForce(int i, vec3 pos, float t) {
  vec4 A = uFieldA[i];
  vec4 B = uFieldB[i];
  vec4 C = uFieldC[i];
  vec4 D = uFieldD[i];
  int kind = int(A.w + 0.5);
  vec3 fpos = A.xyz;
  float radius = B.x;
  float strength = B.y;
  float power = B.z;
  float freq = B.w;
  float tspeed = C.x;
  float seed = C.y;
  float twist = C.z;
  float distortion = C.w;
  float pulse = D.x;
  vec3 dir = D.yzw;

  vec3 delta = pos - fpos;
  float dist = length(delta) + 1e-5;
  vec3 n = delta / dist;
  float atten = falloffAt(dist, radius, power);
  float pulseMod = 1.0 + pulse * sin(t * 6.2831853 - dist * 0.6);

  if (kind == 0) { // radial
    vec3 wob = curlNoise(pos * 0.35 + seed, 0.35) * distortion;
    return (n + wob) * strength * atten * pulseMod;
  } else if (kind == 1) { // vortex
    vec3 axis = normalize(dir + vec3(1e-4));
    vec3 tangential = normalize(cross(axis, n) + vec3(1e-5));
    vec3 inward = -n * twist;
    vec3 turb = curlNoise(pos * 0.5 + seed, 0.4) * distortion;
    return (tangential + inward + turb) * strength * atten * pulseMod;
  } else if (kind == 2) { // attractor
    return -n * strength * atten * pulseMod;
  } else if (kind == 3) { // repulsor
    return n * strength * atten * pulseMod;
  } else if (kind == 4) { // curl / turbulence
    vec3 q = pos * max(freq, 0.001) + vec3(seed) + vec3(0.0, 0.0, t * tspeed * 6.2831853);
    float octaves = uFieldE[i].x;
    vec3 f = curlNoise(q, 0.45);
    if (octaves >= 2.0) f += curlNoise(q * 2.07 + 11.0, 0.45) * 0.45;
    if (octaves >= 3.0) f += curlNoise(q * 4.13 + 23.0, 0.45) * 0.22;
    return f * strength * pulseMod;
  }
  // directional
  return normalize(dir + vec3(1e-4)) * strength * atten * pulseMod;
}

void main() {
  vec4 pos4 = texture(uPosTex, vUv);
  vec4 vel4 = texture(uVelTex, vUv);

  float index = floor(vUv.y * uTexSize) * uTexSize + floor(vUv.x * uTexSize);
  float id = index + uSeed * 0.311;

  if (index >= float(uCount)) {
    outPosition = vec4(0.0, 0.0, 0.0, -1.0);
    outVelocity = vec4(0.0);
    return;
  }

  float lifeRnd = hash11(id * 5.113 + 3.0);
  float lifetime = max(0.25, uLifetime * (1.0 + (lifeRnd - 0.5) * 2.0 * uLifeVar));

  if (uInit || vel4.w <= 0.0) {
    vec3 p = spawnPosition(id);
    outPosition = vec4(p, hash11(id * 9.71) * (uSpawnMode == 1 ? 0.0 : 1.0));
    outVelocity = vec4(spawnVelocity(id, p), lifetime);
    return;
  }

  vec3 pos = pos4.xyz;
  float age = pos4.w;
  vec3 vel = vel4.xyz;
  lifetime = vel4.w;

  float t = uPhase;
  vec3 force = vec3(0.0);
  for (int i = 0; i < ${MAX_FIELDS}; i++) {
    if (i >= uFieldCount) break;
    force += fieldForce(i, pos, t);
  }

  // Cell / blob behaviour: pairwise separation + cohesion over a small population.
  if (uPairwise) {
    vec3 social = vec3(0.0);
    vec3 center = vec3(0.0);
    float counted = 0.0;
    for (int i = 0; i < 256; i++) {
      if (i >= uCount) break;
      float fi = float(i);
      vec2 uv2 = (vec2(mod(fi, uTexSize), floor(fi / uTexSize)) + 0.5) / uTexSize;
      vec3 other = texture(uPosTex, uv2).xyz;
      vec3 d = pos - other;
      float dl = length(d);
      center += other;
      counted += 1.0;
      if (dl > 1e-4 && dl < uClusterRadius) {
        social += normalize(d) * (1.0 - dl / uClusterRadius) * uSeparation * 2.0;
      }
    }
    center /= max(counted, 1.0);
    social += (center - pos) * uMerge * 0.35;
    force += social;
    force += curlNoise(pos * 0.6 + id * 0.01, 0.4) * uMutation * 0.4;
  }

  vel += force * uDt;
  vel *= pow(clamp(uDrag, 0.5, 0.9999), uDt * 60.0);
  pos += vel * uDt;

  age += uDt / lifetime;
  if (age >= 1.0 && uSpawnMode != 0) {
    vec3 p = spawnPosition(id + floor(uTime * 0.37) * 0.0001);
    outPosition = vec4(p, 0.0);
    outVelocity = vec4(spawnVelocity(id, p), lifetime);
    return;
  }

  outPosition = vec4(pos, uSpawnMode == 0 ? fract(age) : min(age, 1.0));
  outVelocity = vec4(vel, lifetime);
}
`;
