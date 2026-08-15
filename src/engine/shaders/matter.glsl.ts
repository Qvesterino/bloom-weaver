import { NOISE_GLSL } from "./noise.glsl";

/** Point-sprite matter renderer: samples the simulation textures and the gradient LUT. */
export const MATTER_VERT = /* glsl */ `
precision highp float;
in float aIndex;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform sampler2D uLut;
uniform float uTexSize;
uniform float uSize;
uniform float uSizeVar;
uniform float uOpacity;
uniform float uViewportHeight;
uniform float uPixelRatio;
uniform float uVelocityStretch;
uniform float uTime;

// dof
uniform bool uDofEnabled;
uniform float uFocusDistance;
uniform float uAperture;
uniform float uBlurStrength;
uniform float uForeground;
uniform float uBackground;

// color mapping
uniform int uSource;
uniform float uInputMin;
uniform float uInputMax;
uniform bool uInvert;
uniform float uMapOffset;
uniform bool uClamp;
uniform float uDepthNear;
uniform float uDepthFar;
uniform float uRadiusScale;

out vec4 vColor;
out float vSoftBias;

${NOISE_GLSL}

void main() {
  vec2 uv = (vec2(mod(aIndex, uTexSize), floor(aIndex / uTexSize)) + 0.5) / uTexSize;
  vec4 pos4 = texture(uPosTex, uv);
  vec4 vel4 = texture(uVelTex, uv);

  if (pos4.w < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vSoftBias = 0.0;
    return;
  }

  vec3 worldPos = pos4.xyz;
  float age = clamp(pos4.w, 0.0, 1.0);
  float speed = length(vel4.xyz);

  vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
  float viewDist = -mvPosition.z;

  float rnd = hash11(aIndex * 1.913 + 7.0);
  float sizeMul = 1.0 + (rnd - 0.5) * 2.0 * uSizeVar;

  // ---- signal selection
  float linearDepth = clamp((viewDist - uDepthNear) / max(uDepthFar - uDepthNear, 0.001), 0.0, 1.0);
  float radial = clamp(length(worldPos) / max(uRadiusScale, 0.001), 0.0, 1.0);
  float vel01 = clamp(speed / 3.0, 0.0, 1.0);
  float energy = clamp(vel01 * 0.65 + (1.0 - age) * 0.35, 0.0, 1.0);
  float signal;
  if (uSource == 0) signal = clamp(energy * 0.5 + (1.0 - radial) * 0.5, 0.0, 1.0); // brightness
  else if (uSource == 1) signal = energy;
  else if (uSource == 2) signal = linearDepth;
  else if (uSource == 3) signal = age;
  else if (uSource == 4) signal = vel01;
  else if (uSource == 5) signal = radial;
  else signal = snoise(worldPos * 0.35 + vec3(0.0, 0.0, uTime * 0.05)) * 0.5 + 0.5;

  float t = (signal + uMapOffset - uInputMin) / max(uInputMax - uInputMin, 0.0001);
  if (uInvert) t = 1.0 - t;
  t = uClamp ? clamp(t, 0.0, 1.0) : fract(max(t, 0.0));

  vec4 lut = texture(uLut, vec2(t, 0.5));

  // ---- depth of field: circle of confusion drives sprite spread and density
  float coc = 0.0;
  if (uDofEnabled) {
    float d = viewDist - uFocusDistance;
    float amount = d < 0.0 ? uForeground : uBackground;
    coc = abs(d) * uAperture * uBlurStrength * amount * 0.16;
    coc = min(coc, 6.0);
  }

  float lifeFade = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.72, 1.0, age));
  float stretch = 1.0 + speed * uVelocityStretch * 0.35;

  float pointSize = uSize * sizeMul * stretch * (1.0 + coc) * uPixelRatio * (uViewportHeight * 0.5) / max(viewDist, 0.05);
  gl_PointSize = clamp(pointSize, 0.0, 900.0);
  gl_Position = projectionMatrix * mvPosition;

  float density = 1.0 / (1.0 + coc * coc * 0.55);
  vColor = vec4(lut.rgb, lut.a * uOpacity * lifeFade * density);
  vSoftBias = clamp(coc * 0.25, 0.0, 1.0);
}
`;

export const MATTER_FRAG = /* glsl */ `
precision highp float;
in vec4 vColor;
in float vSoftBias;
out vec4 fragColor;

uniform float uSoftness;
uniform float uGlow;
uniform float uEmission;
uniform int uKind;     // 0 particles 1 soft 2 cells 3 blobs
uniform float uMerge;
uniform float uSurfaceNoise;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;

  float soft = clamp(uSoftness + vSoftBias, 0.0, 1.6);
  float profile;

  if (uKind == 0) {
    float k = mix(9.0, 1.6, clamp(soft, 0.0, 1.0));
    profile = pow(1.0 - d, k);
    profile += pow(1.0 - d, 24.0) * 0.8;
  } else if (uKind == 1) {
    float g = exp(-d * d * mix(7.0, 2.1, clamp(soft, 0.0, 1.0)));
    profile = g * 1.15;
  } else if (uKind == 2) {
    float edge = mix(0.55, 0.98, clamp(uMerge, 0.0, 1.0));
    float body = 1.0 - smoothstep(edge * 0.55, 1.0, d);
    float membrane = smoothstep(edge * 0.72, edge * 0.92, d) * (1.0 - smoothstep(edge * 0.95, 1.0, d));
    float nucleus = pow(max(0.0, 1.0 - d * 2.6), 2.0);
    profile = body * mix(0.5, 0.95, clamp(soft, 0.0, 1.0)) + membrane * 1.1 + nucleus * 0.9;
  } else {
    float g = exp(-d * d * mix(4.0, 1.35, clamp(soft, 0.0, 1.0)));
    profile = g * (0.85 + uMerge * 0.4);
    profile += pow(1.0 - d, 30.0) * 0.35;
  }

  profile *= 1.0 + uSurfaceNoise * 0.0;
  float alpha = vColor.a * profile;
  if (alpha <= 0.0008) discard;

  vec3 rgb = vColor.rgb * uEmission * (1.0 + uGlow * 0.55);
  fragColor = vec4(rgb * alpha, alpha);
}
`;
