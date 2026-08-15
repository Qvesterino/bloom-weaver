/** Fullscreen post-processing passes: bright pass, blur, diffusion, composite. */

export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BRIGHT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform float uThreshold;
uniform float uSoftness;

void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = max(uSoftness * 0.5, 0.0001);
  float w = smoothstep(uThreshold - knee, uThreshold + knee, lum);
  fragColor = vec4(c * w, 1.0);
}
`;

/** Separable 9-tap gaussian used for both bloom mips and diffusion. */
export const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uRadius;

void main() {
  vec2 step1 = uTexel * uDirection * uRadius;
  vec3 sum = texture(uSource, vUv).rgb * 0.2270270270;
  sum += texture(uSource, vUv + step1 * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSource, vUv - step1 * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSource, vUv + step1 * 3.2307692308).rgb * 0.0702702703;
  sum += texture(uSource, vUv - step1 * 3.2307692308).rgb * 0.0702702703;
  fragColor = vec4(sum, 1.0);
}
`;

export const UPSAMPLE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform sampler2D uPrevious;
uniform float uWeight;

void main() {
  vec3 a = texture(uSource, vUv).rgb;
  vec3 b = texture(uPrevious, vUv).rgb;
  fragColor = vec4(a + b * uWeight, 1.0);
}
`;

export const DIFFUSION_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBlurred;
uniform float uAmount;
uniform float uBrightnessInfluence;

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 blur = texture(uBlurred, vUv).rgb;
  float lum = dot(blur, vec3(0.2126, 0.7152, 0.0722));
  // Local detail is preserved: diffusion is added, never blended over the source.
  float w = mix(1.0, smoothstep(0.0, 0.6, lum), clamp(uBrightnessInfluence, 0.0, 1.0));
  fragColor = vec4(scene + blur * uAmount * w, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec3 uBackground;
uniform float uBackgroundAlpha;
uniform bool uTransparent;

uniform float uBloomIntensity;
uniform float uBloomHaze;

uniform float uExposure;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform float uHighlights;
uniform float uBlacks;

uniform bool uChromaEnabled;
uniform float uChromaAmount;
uniform float uChromaFalloff;

uniform bool uGrainEnabled;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainSpeed;
uniform bool uGrainMono;

uniform bool uVignetteEnabled;
uniform float uVignetteAmount;
uniform float uVignetteSoftness;
uniform float uVignetteRoundness;

uniform float uTime;
uniform vec2 uResolution;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 sampleWithChroma(vec2 uv) {
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  if (!uChromaEnabled || uChromaAmount <= 0.0) {
    vec3 s = texture(uScene, uv).rgb;
    vec3 b = texture(uBloom, uv).rgb;
    return s + b * uBloomIntensity;
  }
  float k = uChromaAmount * 0.02 * pow(clamp(r2 * 2.0, 0.0, 1.0), uChromaFalloff);
  vec2 offset = centered * k;
  vec3 col;
  col.r = texture(uScene, uv + offset).r + texture(uBloom, uv + offset).r * uBloomIntensity;
  col.g = texture(uScene, uv).g + texture(uBloom, uv).g * uBloomIntensity;
  col.b = texture(uScene, uv - offset).b + texture(uBloom, uv - offset).b * uBloomIntensity;
  return col;
}

void main() {
  vec3 col = sampleWithChroma(vUv);

  // broad haze contribution from the widest bloom mip already accumulated
  col += texture(uBloom, vUv).rgb * uBloomHaze * 0.35;

  float sceneLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(uBackground * uBackgroundAlpha, col + uBackground * uBackgroundAlpha, 1.0);

  // ---- tone
  col *= uExposure;
  col = max(col - uBlacks * 0.08, 0.0);
  float hl = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(1.0, 1.0 / (1.0 + max(hl - 1.0, 0.0)), clamp(2.0 - uHighlights, 0.0, 1.0));
  col = (col - 0.5) * uContrast + 0.5;
  col = max(col, 0.0);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSaturation);
  col = pow(max(col, 0.0), vec3(1.0 / max(uGamma, 0.05)));

  // ---- filmic shoulder keeps luminous cores from clipping harshly
  col = col / (1.0 + col * 0.28);
  col *= 1.28;

  if (uGrainEnabled) {
    vec2 gu = vUv * uResolution / max(uGrainScale, 0.05);
    float tt = floor(uTime * 24.0 * uGrainSpeed);
    float n = rand(gu + tt);
    vec3 grain = uGrainMono ? vec3(n) : vec3(n, rand(gu + tt + 3.1), rand(gu + tt + 7.7));
    col += (grain - 0.5) * uGrainAmount;
  }

  if (uVignetteEnabled) {
    vec2 d = (vUv - 0.5) * vec2(mix(uResolution.x / uResolution.y, 1.0, uVignetteRoundness), 1.0);
    float r = length(d) * 1.4142;
    float v = 1.0 - smoothstep(1.0 - uVignetteSoftness, 1.0, r) * uVignetteAmount;
    col *= clamp(v, 0.0, 1.0);
  }

  float alpha = 1.0;
  if (uTransparent) {
    alpha = clamp(max(max(col.r, col.g), col.b) * 1.6 + sceneLum, 0.0, 1.0);
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}
`;
