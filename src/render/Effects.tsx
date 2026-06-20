import { Bloom, EffectComposer, SMAA, TiltShift2, Vignette } from '@react-three/postprocessing';

/**
 * Post-processing glaze (graphics §3). Order: Bloom -> TiltShift -> Vignette -> SMAA.
 * Tone mapping stays on the renderer (AgX) — no ToneMapping effect here (graphics §2.1).
 * Selective bloom is "free": only the ball/ring/confetti exceed the luminance threshold
 * (emissive + toneMapped=false). Tilt-shift is gentle to protect readability (P4).
 * Renders via R3F's frame on advance() under frameloop="never" (tech §3.2).
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.7} />
      <TiltShift2 blur={0.09} />
      <Vignette offset={0.28} darkness={0.55} />
      <SMAA />
    </EffectComposer>
  );
}
