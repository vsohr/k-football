import * as THREE from 'three';
import { PITCH, GOAL } from '@/game';

/**
 * Procedural pitch texture: grass base + mowed stripes + line markings, baked into one
 * CanvasTexture (the research-validated cheap/crisp approach — avoids geometry lines and
 * their oblique-angle artifacts). Drawn in pitch-metre space mapped to pixels so the
 * markings line up with the sim. Anti-flicker (mipmaps + max anisotropy) is set by the
 * caller's material/texture config.
 */
const PLANE_W = PITCH.halfX * 2 + 6; // matches the Field plane size
const PLANE_H = PITCH.halfZ * 2 + 6;
const PX_PER_M = 38;
const STRIPES = 10;

export function makePitchTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = Math.round(PLANE_W * PX_PER_M);
  const h = Math.round(PLANE_H * PX_PER_M);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for pitch texture');

  // metre -> pixel (origin at plane centre; +x right, +z down on the texture)
  const mx = (m: number): number => w / 2 + m * PX_PER_M;
  const mz = (m: number): number => h / 2 + m * PX_PER_M;

  // base grass + mowed stripes (alternating bands along X)
  const stripeW = w / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#3FAE5A' : '#379E50';
    ctx.fillRect(i * stripeW, 0, stripeW + 1, h);
  }
  // subtle vignette-ish darkening at the grass margin
  ctx.fillStyle = 'rgba(0,40,15,0.10)';
  ctx.fillRect(0, 0, w, h);

  // line markings
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, 0.12 * PX_PER_M);
  const hx = PITCH.halfX;
  const hz = PITCH.halfZ;

  // boundary
  ctx.strokeRect(mx(-hx), mz(-hz), 2 * hx * PX_PER_M, 2 * hz * PX_PER_M);
  // halfway line
  ctx.beginPath();
  ctx.moveTo(mx(0), mz(-hz));
  ctx.lineTo(mx(0), mz(hz));
  ctx.stroke();
  // centre circle + spot
  ctx.beginPath();
  ctx.arc(mx(0), mz(0), 4 * PX_PER_M, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(mx(0), mz(0), 0.18 * PX_PER_M, 0, Math.PI * 2);
  ctx.fill();

  // penalty boxes + goal areas at each end
  const boxDepth = 6;
  const boxHalfW = GOAL.halfWidth + 3;
  const goalAreaDepth = 2.5;
  const goalAreaHalfW = GOAL.halfWidth + 1;
  for (const sign of [-1, 1] as const) {
    const lineX = sign * hx;
    const boxX = lineX - sign * boxDepth;
    ctx.strokeRect(
      mx(Math.min(lineX, boxX)),
      mz(-boxHalfW),
      boxDepth * PX_PER_M,
      2 * boxHalfW * PX_PER_M,
    );
    const gaX = lineX - sign * goalAreaDepth;
    ctx.strokeRect(
      mx(Math.min(lineX, gaX)),
      mz(-goalAreaHalfW),
      goalAreaDepth * PX_PER_M,
      2 * goalAreaHalfW * PX_PER_M,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
