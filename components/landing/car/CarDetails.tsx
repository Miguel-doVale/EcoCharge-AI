"use client";

/* Detalhes externos: rodas, luzes, frisos, vincos de portas, maçanetas, antena, palhetas... */
import { useMemo } from "react";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { honeycombTexture, sidewallTexture, treadTexture } from "./textures";

export const SIDE_Z = 0.89;
const SEAM = "#2b3036";

/* ---------- roda ---------- */
export function Wheel({ x, z }: { x: number; z: number }) {
  const s = z < 0 ? -1 : 1; // lado externo (no grupo girado, +y local = +z do mundo)
  const m = useMemo(() => {
    const tread = treadTexture();
    return {
      tread: new THREE.MeshStandardMaterial({ map: tread, bumpMap: tread, bumpScale: 2.5, roughness: 0.95, color: "#ffffff" }),
      side: new THREE.MeshStandardMaterial({ map: sidewallTexture(), roughness: 0.9 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#141619", roughness: 0.92 }),
      rim: new THREE.MeshPhysicalMaterial({ color: "#c9ced4", metalness: 1, roughness: 0.22, clearcoat: 0.8 }),
      rimDark: new THREE.MeshPhysicalMaterial({ color: "#2c3138", metalness: 0.9, roughness: 0.35 }),
      disc: new THREE.MeshStandardMaterial({ color: "#8d9298", metalness: 0.9, roughness: 0.45 }),
      caliper: new THREE.MeshStandardMaterial({ color: "#23897f", roughness: 0.4, metalness: 0.3 }),
    };
  }, []);
  return (
    <group position={[x, 0.33, z]} rotation={[Math.PI / 2, 0, 0]}>
      {/* pneu: banda de rodagem + laterais arredondadas */}
      <mesh castShadow material={[m.tread, m.side, m.side]}>
        <cylinderGeometry args={[0.315, 0.315, 0.19, 64, 1, false]} />
      </mesh>
      {[-0.095, 0.095].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.rubber}>
          <torusGeometry args={[0.285, 0.03, 16, 64]} />
        </mesh>
      ))}
      {/* barril do aro (fundo escuro) */}
      <mesh position={[0, s * -0.02, 0]} material={m.rimDark}>
        <cylinderGeometry args={[0.235, 0.235, 0.16, 48, 1, true]} />
      </mesh>
      {/* disco e pinça de freio */}
      <mesh position={[0, -s * 0.03, 0]} material={m.disc}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 40]} />
      </mesh>
      <mesh position={[0.12, -s * 0.045, 0.06]} rotation={[0, -0.5, 0]} material={m.caliper}>
        <boxGeometry args={[0.06, 0.04, 0.11]} />
      </mesh>
      {/* aro: borda + 5 raios duplos + cubo + porcas */}
      <mesh position={[0, s * 0.092, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.rim}>
        <torusGeometry args={[0.228, 0.012, 12, 64]} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          {[-0.022, 0.022].map((o) => (
            <mesh key={o} position={[0.12, s * 0.085, o]} rotation={[0, o > 0 ? -0.08 : 0.08, s * 0.12]} material={m.rim}>
              <boxGeometry args={[0.2, 0.014, 0.022]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, s * 0.09, 0]} material={m.rim}>
        <cylinderGeometry args={[0.055, 0.06, 0.03, 32]} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.6;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.04, s * 0.106, Math.sin(a) * 0.04]} material={m.rimDark}>
            <cylinderGeometry args={[0.007, 0.007, 0.012, 8]} />
          </mesh>
        );
      })}
      <mesh position={[0, s * 0.107, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.006, 24]} />
        <meshStandardMaterial color="#121416" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function ArchTrim({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.34, z + (z < 0 ? -0.002 : 0.002)]} rotation={[0, z < 0 ? Math.PI : 0, 0]}>
      <ringGeometry args={[0.45, 0.505, 48, 1, 0, Math.PI]} />
      <meshStandardMaterial color="#0f1114" roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ---------- contornos (vincos) ---------- */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 16) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
}
function seam(pts2: [number, number][], z: number) {
  return pts2.map(([x, y]) => new THREE.Vector3(x, y, z));
}
/** porta dianteira (contorno idêntico ao da porta do motorista) */
export function frontDoorOutline(): [number, number][] {
  const a0 = Math.PI - Math.asin(0.04 / 0.49), a1 = Math.acos((1.18 - 1.35) / 0.49);
  return [[-0.05, 0.99], [-0.05, 0.38], [1.35 + 0.49 * Math.cos(a0), 0.38], ...arcPts(1.35, 0.34, 0.49, a0, a1), [1.18, 0.99], [-0.05, 0.99]];
}
function rearDoorOutline(): [number, number][] {
  const a0 = Math.asin(0.04 / 0.49);
  return [[-0.09, 0.99], [-0.09, 0.38], [-1.35 + 0.49 * Math.cos(a0), 0.38], ...arcPts(-1.35, 0.34, 0.49, a0, 1.05), [-1.35 + 0.49 * Math.cos(1.05), 0.99], [-0.09, 0.99]];
}

export function BodyDetails() {
  const grille = useMemo(() => { const t = honeycombTexture(); return t; }, []);
  const black = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#0d0f12", roughness: 0.3, metalness: 0.3, clearcoat: 1 }), []);
  const handle = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#16191c", metalness: 0.6, roughness: 0.3, clearcoat: 1 }), []);
  return (
    <group>
      {/* vincos: portas traseiras (2 lados) e dianteira do passageiro */}
      <Line points={seam(rearDoorOutline(), -SIDE_Z - 0.002)} color={SEAM} lineWidth={1.4} />
      <Line points={seam(rearDoorOutline(), SIDE_Z + 0.002)} color={SEAM} lineWidth={1.4} />
      <Line points={seam(frontDoorOutline(), SIDE_Z + 0.002)} color={SEAM} lineWidth={1.4} />
      {/* tampa traseira */}
      <Line points={[[-2.124, 0.55, -0.62], [-2.124, 0.55, 0.62], [-2.124, 0.98, 0.62], [-2.124, 0.98, -0.62], [-2.124, 0.55, -0.62]]} color={SEAM} lineWidth={1.4} />

      {/* maçanetas embutidas (passageiro e traseiras) */}
      {[[0.13, 0.9, SIDE_Z], [-0.98, 0.9, SIDE_Z], [-0.98, 0.9, -SIDE_Z]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z + Math.sign(z) * 0.002]} material={handle}>
          <boxGeometry args={[0.15, 0.022, 0.006]} />
        </mesh>
      ))}

      {/* tampa de recarga (lateral traseira direita) */}
      <group position={[-1.78, 0.8, SIDE_Z + 0.003]}>
        <RoundedBox args={[0.16, 0.12, 0.006]} radius={0.003}>
          <meshPhysicalMaterial color="#e9ecec" roughness={0.3} clearcoat={1} />
        </RoundedBox>
        <Line points={[[-0.082, -0.062, 0.004], [0.082, -0.062, 0.004], [0.082, 0.062, 0.004], [-0.082, 0.062, 0.004], [-0.082, -0.062, 0.004]]} color={SEAM} lineWidth={1.2} />
        <mesh position={[0.05, 0.035, 0.004]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color="#2fd3c0" toneMapped={false} /></mesh>
      </group>

      {/* piscas laterais */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[1.62, 0.82, sd * (SIDE_Z + 0.003)]} rotation={[0, sd < 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[0.06, 0.012]} />
          <meshBasicMaterial color="#ffb03a" toneMapped={false} />
        </mesh>
      ))}

      {/* frente: barra de luz, faróis com projetores, grade, faróis de neblina */}
      <mesh position={[2.14, 0.8, 0]}>
        <boxGeometry args={[0.02, 0.008, 1.2]} />
        <meshBasicMaterial color="#e8fbff" toneMapped={false} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[2.105, 0.765, sd * 0.6]} rotation={[0, sd * -0.25, -0.18]}>
          <RoundedBox args={[0.07, 0.06, 0.36]} radius={0.022}>
            <meshPhysicalMaterial color="#0b0e12" roughness={0.05} metalness={0.5} clearcoat={1} />
          </RoundedBox>
          {[-0.08, 0.06].map((o) => (
            <mesh key={o} position={[0.03, 0, o]} rotation={[0, Math.PI / 2, 0]}>
              <circleGeometry args={[0.022, 24]} />
              <meshPhysicalMaterial color="#dfe8ee" metalness={1} roughness={0.08} />
            </mesh>
          ))}
          <mesh position={[0.036, -0.022, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.3, 0.008]} />
            <meshBasicMaterial color="#f4feff" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[2.152, 0.46, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.0, 0.1]} />
        <meshStandardMaterial map={grille} roughness={0.6} />
      </mesh>
      <RoundedBox args={[0.05, 0.14, 1.36]} radius={0.025} position={[2.12, 0.46, 0]} material={black} />
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[2.15, 0.46, sd * 0.6]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.1, 0.02]} />
          <meshBasicMaterial color="#e8f5ff" toneMapped={false} />
        </mesh>
      ))}
      {/* placa (vazia) */}
      <mesh position={[2.152, 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.4, 0.13]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.6} />
      </mesh>

      {/* palhetas do limpador */}
      {[-0.32, 0.18].map((z) => (
        <mesh key={z} position={[1.24, 1.035, z]} rotation={[0, 0.25, 0.32]} material={black}>
          <boxGeometry args={[0.012, 0.012, 0.55]} />
        </mesh>
      ))}

      {/* traseira: lanternas, barra, para-choque, refletores, placa */}
      <mesh position={[-2.2, 0.93, 0]}>
        <boxGeometry args={[0.02, 0.018, 1.45]} />
        <meshBasicMaterial color="#ff2a3d" toneMapped={false} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[-2.16, 0.88, sd * 0.68]}>
          <RoundedBox args={[0.06, 0.1, 0.22]} radius={0.02}>
            <meshPhysicalMaterial color="#3a0a10" roughness={0.1} clearcoat={1} transparent opacity={0.92} />
          </RoundedBox>
          <mesh position={[-0.032, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.18, 0.012]} />
            <meshBasicMaterial color="#ff3045" toneMapped={false} />
          </mesh>
          <mesh position={[-0.032, -0.03, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.06, 0.012]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <RoundedBox args={[0.06, 0.15, 1.42]} radius={0.03} position={[-2.17, 0.45, 0]} material={black} />
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[-2.202, 0.45, sd * 0.58]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.12, 0.018]} />
          <meshBasicMaterial color="#a8101c" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[-2.124, 0.66, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.4, 0.13]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.6} />
      </mesh>

      {/* antena "barbatana" */}
      <mesh position={[-1.35, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.35]} material={black}>
        <coneGeometry args={[0.05, 0.2, 24]} />
      </mesh>

      {/* saias laterais */}
      {[-0.905, 0.905].map((z) => (
        <RoundedBox key={z} args={[1.7, 0.055, 0.03]} radius={0.012} position={[0, 0.36, z]} material={black} />
      ))}
      {/* retrovisores com pisca */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[1.12, 1.07, sd * 0.94]}>
          <RoundedBox args={[0.13, 0.095, 0.16]} radius={0.04} material={black} />
          <mesh position={[0.02, -0.035, -sd * 0.07]} material={black}><boxGeometry args={[0.05, 0.02, 0.06]} /></mesh>
          <mesh position={[0.066, -0.03, sd * 0.03]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.08, 0.008]} />
            <meshBasicMaterial color="#ffb03a" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
