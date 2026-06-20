import * as THREE from 'three';

const MAX = 160;
const GRAVITY = 13;
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * Pooled instanced confetti for the goal celebration. Framework-free state; the render
 * loop calls update(dt) on real time and writeTo(mesh) each frame, and burst() on a goal.
 */
export class ConfettiController {
  readonly max = MAX;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private col = new Float32Array(MAX * 3);
  private next = 0;

  burst(x: number, y: number, z: number, baseColor: string, count = 110): void {
    tmpColor.set(baseColor);
    for (let i = 0; i < count; i++) {
      const s = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const spread = 3 + Math.random() * 7;
      this.pos[s * 3] = x;
      this.pos[s * 3 + 1] = y;
      this.pos[s * 3 + 2] = z;
      this.vel[s * 3] = Math.cos(a) * spread * 0.7;
      this.vel[s * 3 + 1] = 6 + Math.random() * 8;
      this.vel[s * 3 + 2] = Math.sin(a) * spread * 0.7;
      const life = 1.3 + Math.random() * 1.0;
      this.life[s] = life;
      this.maxLife[s] = life;
      const j = 0.7 + Math.random() * 0.3;
      this.col[s * 3] = tmpColor.r * j;
      this.col[s * 3 + 1] = tmpColor.g * j;
      this.col[s * 3 + 2] = tmpColor.b * j;
    }
  }

  update(dt: number): void {
    for (let s = 0; s < MAX; s++) {
      if (this.life[s] <= 0) continue;
      this.life[s] -= dt;
      this.vel[s * 3 + 1] -= GRAVITY * dt;
      this.pos[s * 3] += this.vel[s * 3] * dt;
      this.pos[s * 3 + 1] += this.vel[s * 3 + 1] * dt;
      this.pos[s * 3 + 2] += this.vel[s * 3 + 2] * dt;
      if (this.pos[s * 3 + 1] < 0.05) {
        this.pos[s * 3 + 1] = 0.05;
        this.vel[s * 3 + 1] *= -0.25;
        this.vel[s * 3] *= 0.6;
        this.vel[s * 3 + 2] *= 0.6;
      }
    }
  }

  writeTo(mesh: THREE.InstancedMesh): void {
    for (let s = 0; s < MAX; s++) {
      const alive = this.life[s] > 0;
      const scale = alive ? 0.16 * Math.min(1, this.life[s] / (this.maxLife[s] * 0.4)) : 0;
      dummy.position.set(this.pos[s * 3], this.pos[s * 3 + 1], this.pos[s * 3 + 2]);
      dummy.rotation.set(this.pos[s * 3] * 3, this.pos[s * 3 + 1] * 3, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(s, dummy.matrix);
      if (alive) {
        tmpColor.setRGB(this.col[s * 3], this.col[s * 3 + 1], this.col[s * 3 + 2]);
        mesh.setColorAt(s, tmpColor);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
