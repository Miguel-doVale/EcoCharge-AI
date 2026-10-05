"use client";

/* Interior: painel, volante, instrumentos, console, bancos, forros, teto e acessórios. */
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { carpetTexture, clusterTexture, seatTexture, speakerTexture } from "./textures";

/** perfil lateral do painel (corte), extrudado na largura da cabine */
function dashShape() {
  const s = new THREE.Shape();
  s.moveTo(1.32, 0.55);
  s.lineTo(1.32, 1.0);
  s.quadraticCurveTo(1.0, 1.06, 0.74, 1.045);
  s.quadraticCurveTo(0.6, 1.04, 0.585, 0.975);
  s.lineTo(0.6, 0.86);
  s.quadraticCurveTo(0.66, 0.7, 0.88, 0.6);
  s.lineTo(1.32, 0.55);
  return s;
}

const C = { dash: "#1c2025", accent: "#b7b0a4", teal: "#2fd3c0", seat: "#2b3036", trim: "#262b31", head: "#5d636a" };

function Seat({ x, z, width = 0.5, rear = false }: { x: number; z: number; width?: number; rear?: boolean }) {
  const m = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: C.seat, roughness: 0.85 }),
    insert: new THREE.MeshStandardMaterial({ map: seatTexture("#4a5058"), roughness: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#aab1b8", metalness: 0.9, roughness: 0.25 }),
  }), []);
  const w = width;
  return (
    <group position={[x, 0, z]}>
      {/* assento: base + insert + abas laterais */}
      <RoundedBox args={[0.5, 0.12, w]} radius={0.05} position={[0, 0.5, 0]} material={m.shell} />
      <RoundedBox args={[0.4, 0.035, w * 0.6]} radius={0.015} position={[0.02, 0.57, 0]} material={m.insert} />
      {!rear && [-1, 1].map((sd) => (
        <RoundedBox key={sd} args={[0.44, 0.07, 0.07]} radius={0.03} position={[0.01, 0.585, sd * (w / 2 - 0.05)]} rotation={[sd * 0.25, 0, 0]} material={m.shell} />
      ))}
      {/* encosto */}
      <group position={[-0.27, 0.84, 0]} rotation={[0, 0, 0.2]}>
        <RoundedBox args={[0.11, 0.6, w]} radius={0.05} material={m.shell} />
        <RoundedBox args={[0.025, 0.46, w * 0.58]} radius={0.01} position={[0.058, -0.02, 0]} material={m.insert} />
        {!rear && [-1, 1].map((sd) => (
          <RoundedBox key={sd} args={[0.08, 0.5, 0.07]} radius={0.03} position={[0.05, -0.02, sd * (w / 2 - 0.05)]} rotation={[0, sd * 0.35, 0]} material={m.shell} />
        ))}
        {/* encosto de cabeça + hastes */}
        {(rear ? [-0.42, 0, 0.42] : [0]).map((hz) => (
          <group key={hz} position={[-0.01, 0.42, hz]}>
            {[-0.06, 0.06].map((pz) => (
              <mesh key={pz} position={[0, -0.05, pz]} material={m.chrome}><cylinderGeometry args={[0.006, 0.006, 0.08, 8]} /></mesh>
            ))}
            <RoundedBox args={[0.09, 0.15, 0.26]} radius={0.04} position={[0, 0.05, 0]} material={m.shell} />
          </group>
        ))}
      </group>
    </group>
  );
}

function DoorTrim({ x0, x1, z }: { x0: number; x1: number; z: number }) {
  const sd = Math.sign(z);
  const speaker = useMemo(speakerTexture, []);
  const cx = (x0 + x1) / 2, w = x1 - x0;
  return (
    <group position={[cx, 0, z]} rotation={[0, sd > 0 ? Math.PI : 0, 0]}>
      <mesh position={[0, 0.69, 0]}><planeGeometry args={[w, 0.6]} /><meshStandardMaterial color={C.trim} roughness={0.9} /></mesh>
      <mesh position={[0, 0.86, 0.003]}><planeGeometry args={[w - 0.08, 0.12]} /><meshStandardMaterial color={C.head} roughness={0.85} /></mesh>
      <RoundedBox args={[w * 0.5, 0.035, 0.07]} radius={0.015} position={[w * 0.05, 0.76, 0.035]}><meshStandardMaterial color="#4a5058" roughness={0.9} /></RoundedBox>
      <mesh position={[0, 0.925, 0.004]}><planeGeometry args={[w - 0.1, 0.004]} /><meshBasicMaterial color={C.teal} toneMapped={false} /></mesh>
      <mesh position={[w * 0.25, 0.55, 0.004]}><circleGeometry args={[0.07, 32]} /><meshStandardMaterial map={speaker} roughness={0.8} /></mesh>
      <mesh position={[w * 0.3, 0.86, 0.01]}><boxGeometry args={[0.08, 0.02, 0.015]} /><meshStandardMaterial color="#aab1b8" metalness={0.9} roughness={0.25} /></mesh>
    </group>
  );
}

export default function CarInterior({ withDriverDoorTrim = false }: { withDriverDoorTrim?: boolean }) {
  const m = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: C.trim, roughness: 0.95, envMapIntensity: 0.25 }),
    carpet: new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }),
    headliner: new THREE.MeshStandardMaterial({ color: "#8a8f94", roughness: 1 }),
    dash: new THREE.MeshStandardMaterial({ color: C.dash, roughness: 0.85, envMapIntensity: 0.3 }),
  }), []);
  const dashGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(dashShape(), { depth: 1.5, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 4, curveSegments: 32 });
    g.translate(0, 0, -0.75); return g;
  }, []);
  const cluster = useMemo(clusterTexture, []);

  return (
    <group>
      {/* revestimento: faces viradas para dentro (invisíveis de fora) */}
      <mesh position={[-0.22, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.carpet}><planeGeometry args={[3.05, 1.68]} /></mesh>
      <mesh position={[-1.74, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} material={m.wall}><planeGeometry args={[1.68, 0.6]} /></mesh>
      <mesh position={[-0.55, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.headliner}><planeGeometry args={[2.2, 1.3]} /></mesh>
      <mesh position={[-0.05, 1.495, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.05, 24]} /><meshBasicMaterial color="#f7f3ea" toneMapped={false} /></mesh>
      {/* forros de porta: passageiro (dianteira/traseira) e traseira do motorista */}
      <DoorTrim x0={-0.05} x1={1.18} z={0.84} />
      <DoorTrim x0={-1.13} x1={-0.09} z={0.84} />
      <DoorTrim x0={-1.13} x1={-0.09} z={-0.84} />
      {withDriverDoorTrim && <DoorTrim x0={-0.05} x1={1.18} z={-0.84} />}
      <mesh position={[-1.44, 0.7, -0.84]} material={m.wall}><planeGeometry args={[0.6, 0.6]} /></mesh>
      <mesh position={[-1.44, 0.7, 0.84]} rotation={[0, Math.PI, 0]} material={m.wall}><planeGeometry args={[0.6, 0.6]} /></mesh>

      {/* painel */}
      <mesh geometry={dashGeo} material={m.dash} />
      <mesh position={[0.588, 0.965, 0]}><boxGeometry args={[0.012, 0.028, 1.46]} /><meshStandardMaterial color={C.accent} roughness={0.6} /></mesh>
      <mesh position={[0.6, 0.862, 0]}><boxGeometry args={[0.006, 0.004, 1.4]} /><meshBasicMaterial color={C.teal} toneMapped={false} /></mesh>
      {[-0.6, -0.2, 0.22, 0.62].map((z) => (
        <group key={z} position={[0.594, 0.915, z]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh><torusGeometry args={[0.03, 0.007, 12, 32]} /><meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.25} /></mesh>
          <mesh position={[0, 0, -0.004]}><circleGeometry args={[0.026, 32]} /><meshStandardMaterial color="#0c0e11" roughness={0.8} /></mesh>
          <mesh><boxGeometry args={[0.05, 0.004, 0.004]} /><meshStandardMaterial color="#3a4048" /></mesh>
        </group>
      ))}
      {/* porta-luvas (vinco) */}
      <mesh position={[0.63, 0.78, 0.4]} rotation={[0, -Math.PI / 2, 0.35]}><planeGeometry args={[0.42, 0.003]} /><meshBasicMaterial color="#0a0b0d" /></mesh>

      {/* quadro de instrumentos */}
      <group position={[0.7, 1.1, -0.38]} rotation={[0, -Math.PI / 2, 0]}>
        <group rotation={[-0.25, 0, 0]}>
          <RoundedBox args={[0.19, 0.08, 0.02]} radius={0.008} position={[0, 0, -0.011]}><meshStandardMaterial color="#0c0e11" roughness={0.4} /></RoundedBox>
          <mesh><planeGeometry args={[0.175, 0.066]} /><meshBasicMaterial map={cluster} toneMapped={false} /></mesh>
        </group>
      </group>

      {/* volante */}
      <group position={[0.36, 0.99, -0.38]} rotation={[0, -Math.PI / 2, 0]}>
        <group rotation={[-0.4, 0, 0]}>
          <mesh><torusGeometry args={[0.175, 0.018, 18, 72]} /><meshStandardMaterial color="#17191d" roughness={0.6} /></mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.1, -0.012, 0]}>
              <boxGeometry args={[0.14, 0.04, 0.02]} />
              <meshStandardMaterial color="#17191d" roughness={0.55} />
            </mesh>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={"b" + sd} position={[sd * 0.1, -0.012, 0.012]}>
              <boxGeometry args={[0.05, 0.025, 0.004]} />
              <meshStandardMaterial color="#aab1b8" metalness={0.9} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, -0.09, 0]}><boxGeometry args={[0.045, 0.16, 0.02]} /><meshStandardMaterial color="#17191d" roughness={0.55} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0.006]}>
            <cylinderGeometry args={[0.058, 0.062, 0.032, 32]} />
            <meshStandardMaterial color="#2a2f35" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, -0.13]}>
            <cylinderGeometry args={[0.03, 0.045, 0.24, 20]} />
            <meshStandardMaterial color="#14171a" roughness={0.7} />
          </mesh>
          {/* alavancas atrás do volante */}
          {[-1, 1].map((sd) => (
            <mesh key={"h" + sd} position={[sd * 0.09, 0, -0.07]} rotation={[0, 0, sd * 0.2]}>
              <boxGeometry args={[0.1, 0.012, 0.012]} />
              <meshStandardMaterial color="#14171a" roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>

      {/* console central */}
      <RoundedBox args={[0.85, 0.2, 0.22]} radius={0.04} position={[0.12, 0.62, 0]} material={m.dash} />
      <RoundedBox args={[0.36, 0.06, 0.2]} radius={0.025} position={[-0.25, 0.75, 0]}><meshStandardMaterial color="#4a5058" roughness={0.9} /></RoundedBox>
      <mesh position={[0.3, 0.76, 0]}><sphereGeometry args={[0.03, 24, 24]} /><meshPhysicalMaterial color="#ffffff" transmission={0.7} roughness={0.05} thickness={0.04} /></mesh>
      <mesh position={[0.1, 0.723, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.18, 0.12]} /><meshStandardMaterial color="#0e1013" roughness={0.3} metalness={0.4} /></mesh>
      {[-0.06, 0, 0.06].map((z) => (
        <mesh key={z} position={[0.42, 0.725, z]}><cylinderGeometry args={[0.012, 0.012, 0.01, 16]} /><meshStandardMaterial color="#aab1b8" metalness={0.9} roughness={0.25} /></mesh>
      ))}

      {/* bancos dianteiros e banco traseiro inteiriço */}
      <Seat x={-0.2} z={-0.38} />
      <Seat x={-0.2} z={0.38} />
      <Seat x={-1.15} z={0} width={1.4} rear />
      {/* cinto do motorista */}
      <mesh position={[-0.42, 0.98, -0.62]} rotation={[0.55, 0, 0.15]}>
        <boxGeometry args={[0.006, 0.6, 0.045]} />
        <meshStandardMaterial color="#141619" roughness={0.9} />
      </mesh>

      {/* retrovisor interno e quebra-sóis */}
      <group position={[0.42, 1.38, 0]}>
        <mesh position={[0.04, 0.05, 0]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.012, 0.08, 0.02]} /><meshStandardMaterial color="#14171a" /></mesh>
        <RoundedBox args={[0.03, 0.06, 0.24]} radius={0.015} rotation={[0, 0.15, 0]}><meshStandardMaterial color="#14171a" roughness={0.5} /></RoundedBox>
      </group>
      {[-0.4, 0.4].map((z) => (
        <RoundedBox key={z} args={[0.16, 0.012, 0.36]} radius={0.005} position={[0.22, 1.46, z]} rotation={[0, 0, -0.12]}>
          <meshStandardMaterial color="#8a8f94" roughness={1} />
        </RoundedBox>
      ))}
    </group>
  );
}
