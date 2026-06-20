import * as THREE from 'three';

/**
 * Procedural soccer-ball albedo (graphics §3): a white panel base with the iconic
 * black pentagons, drawn to an equirectangular CanvasTexture and wrapped onto a
 * SphereGeometry. The 12 pentagon centres are the directions of an icosahedron's
 * vertices — converted to three.js sphere UVs so they land on the right facets.
 * No external assets; the ball is small and rolls fast, so this reads cleanly.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

// 12 icosahedron vertex directions = the pentagon centres of a truncated icosahedron.
const PENTAGON_CENTERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, PHI],
  [0, 1, -PHI],
  [0, -1, PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [1, -PHI, 0],
  [-1, PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, 1],
  [-PHI, 0, -1],
];

const TEX_WIDTH = 1024;
const TEX_HEIGHT = 512;
const PENTAGON_RADIUS = 60;

/** Direction (unit vector) → three.js SphereGeometry UV. */
function directionToUv(x: number, y: number, z: number): { u: number; v: number } {
  const length = Math.hypot(x, y, z);
  const ny = y / length;
  const theta = Math.acos(THREE.MathUtils.clamp(ny, -1, 1)); // 0 at top, π at bottom
  let phi = Math.atan2(z / length, -x / length);
  if (phi < 0) phi += Math.PI * 2;
  return { u: phi / (Math.PI * 2), v: theta / Math.PI };
}

/** Filled pentagon, stretched horizontally to counter equirectangular distortion. */
function fillPentagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusY: number,
  radiusX: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = cx + radiusX * Math.cos(angle);
    const py = cy + radiusY * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function makeBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_WIDTH;
  canvas.height = TEX_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('2D canvas context unavailable for ball texture');
  }

  ctx.fillStyle = '#f3f5f7';
  ctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);

  ctx.fillStyle = '#16181d';
  for (const [x, y, z] of PENTAGON_CENTERS) {
    const { u, v } = directionToUv(x, y, z);
    const theta = v * Math.PI;
    const radiusX = PENTAGON_RADIUS / Math.max(0.5, Math.sin(theta));
    const cx = u * TEX_WIDTH;
    const cy = v * TEX_HEIGHT;
    // Draw across the u-seam so pentagons that straddle u=0/1 stay whole.
    for (const offset of [-TEX_WIDTH, 0, TEX_WIDTH]) {
      fillPentagon(ctx, cx + offset, cy, PENTAGON_RADIUS, radiusX);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
