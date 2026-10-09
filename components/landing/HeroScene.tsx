"use client";

/* Cena 3D do hero (Three.js via React Three Fiber).
   Usa o MESMO mundo simulado do navegador: prédios, ruas, carregadores e EVs. */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { buildRoute, createWorld, level, stepEV, type Pt } from "@/lib/ev/world";

const S = 0.01; // metros -> unidades da cena
const CENTER = { x: 1950, y: 1200 }; // em torno do carro (nó 13,8)
const RADIUS = 1500;
const STATUS = { ok: "#3ee08f", warn: "#ffc23d", full: "#ff5a4a", off: "#7c8590" } as const;

/* paletas da cena: escuro (noite) e claro (tons da logo) */
const PAL = {
  dark: { bg: "#07090b", ground: "#0b0e12", road: "#1a1f25", major: "#2a3038", river: "#0b2a44", riverE: "#0a2238", sky: "#9fb7ff", floor: "#0a0c0f", hemi: 0.55, sun: 1.1, route: "#b8ff3c", ev: "#2fe0c4", bld: [0.07, 0.085, 0.1, 0.05, 0.06, 0.07] },
  light: { bg: "#e2eddf", ground: "#d6e4d1", road: "#c3d3be", major: "#b2c6ad", river: "#9cc3d6", riverE: "#4d8aa8", sky: "#ffffff", floor: "#a9bfa3", hemi: 1.3, sun: 1.6, route: "#3d5c3f", ev: "#13917c", bld: [0.86, 0.9, 0.84, -0.12, -0.08, -0.12] },
};
type Pal = typeof PAL.dark;

const toV = (p: Pt, y = 0) => new THREE.Vector3((p.x - CENTER.x) * S, y, (p.y - CENTER.y) * S);
const near = (p: Pt, r = RADIUS) => Math.hypot(p.x - CENTER.x, p.y - CENTER.y) < r;

function useWorld() {
  return useMemo(() => {
    const w = createWorld();
    const car = w.nodes[w.nid(13, 8)];
    const targets = w.chargers.filter((c) => near(c.pos, 1300)).sort((a, b) => Math.hypot(a.pos.x - car.x, a.pos.y - car.y) - Math.hypot(b.pos.x - car.x, b.pos.y - car.y));
    const target = targets[Math.min(2, targets.length - 1)] ?? w.chargers[0];
    const route = buildRoute(w, car, target)!;
    return { w, route, target };
  }, []);
}

function Buildings({ w, pal }: { w: ReturnType<typeof createWorld>; pal: Pal }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => w.buildings.filter((b) => near(b.c[0])), [w]);
  useEffect(() => {
    const m = ref.current!; const o = new THREE.Object3D(); const col = new THREE.Color();
    list.forEach((b, i) => {
      const [a, bb, c] = b.c;
      const wdt = Math.hypot(bb.x - a.x, bb.y - a.y), dep = Math.hypot(c.x - bb.x, c.y - bb.y);
      const cx = (b.c[0].x + b.c[2].x) / 2, cy = (b.c[0].y + b.c[2].y) / 2;
      const h = b.h * 0.9;
      o.position.set((cx - CENTER.x) * S, (h * S) / 2, (cy - CENTER.y) * S);
      o.rotation.set(0, -Math.atan2(bb.y - a.y, bb.x - a.x), 0);
      o.scale.set(wdt * S, h * S, dep * S);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      const t = Math.min(1, b.h / 90);
      const [r, g, b2, dr, dg, db] = pal.bld;
      m.setColorAt(i, col.setRGB(r + t * dr, g + t * dg, b2 + t * db));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list, pal]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.85} metalness={0.15} />
    </instancedMesh>
  );
}

function Roads({ w, pal }: { w: ReturnType<typeof createWorld>; pal: Pal }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(() => w.edges.filter((e) => near(w.nodes[e.a]) || near(w.nodes[e.b])), [w]);
  useEffect(() => {
    const m = ref.current!; const o = new THREE.Object3D(); const col = new THREE.Color();
    list.forEach((e, i) => {
      const a = w.nodes[e.a], b = w.nodes[e.b];
      o.position.set(((a.x + b.x) / 2 - CENTER.x) * S, 0.005, ((a.y + b.y) / 2 - CENTER.y) * S);
      o.rotation.set(0, -Math.atan2(b.y - a.y, b.x - a.x), 0);
      o.scale.set((e.len + (e.major ? 18 : 10)) * S, 0.01, (e.major ? 18 : 10) * S);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(e.major ? pal.major : pal.road));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list, w, pal]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} receiveShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}

function River({ pal }: { pal: Pal }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    const x0 = CENTER.x - RADIUS - 400, x1 = CENTER.x + RADIUS + 400;
    const ry = (x: number) => (11 + 0.5) * 150 + 18 * Math.sin(x / 310) + 6 * Math.sin(x / 113 + 1);
    shape.moveTo((x0 - CENTER.x) * S, -(ry(x0) - 30 - CENTER.y) * S);
    for (let x = x0; x <= x1; x += 40) shape.lineTo((x - CENTER.x) * S, -(ry(x) - 30 - CENTER.y) * S);
    for (let x = x1; x >= x0; x -= 40) shape.lineTo((x - CENTER.x) * S, -(ry(x) + 30 - CENTER.y) * S);
    return new THREE.ShapeGeometry(shape);
  }, []);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <meshStandardMaterial color={pal.river} emissive={pal.riverE} emissiveIntensity={pal === PAL.light ? 0.15 : 0.6} roughness={0.2} metalness={0.4} />
    </mesh>
  );
}

function ChargerBeacon({ p, color, idx, light, day }: { p: THREE.Vector3; color: string; idx: number; light: boolean; day: boolean }) {
  const blend = day ? THREE.NormalBlending : THREE.AdditiveBlending;
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.6 + idx * 0.37) % 1;
    if (ring.current) { ring.current.scale.setScalar(0.4 + t * 2.4); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t); }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 2 + idx) * 0.12;
  });
  return (
    <group position={p}>
      <mesh ref={beam} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.04, 0.14, 3.2, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} blending={blend} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {light && <pointLight color={color} intensity={2.2} distance={4} decay={1.6} position={[0, 0.5, 0]} />}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.3, 0.38, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={blend} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Chargers({ w, day }: { w: ReturnType<typeof createWorld>; day: boolean }) {
  // cada luz pontual pesa em todos os materiais: só os 4 postos mais próximos do centro iluminam o chão
  const list = useMemo(() => w.chargers.filter((c) => near(c.pos)).sort((a, b) => Math.hypot(a.pos.x - CENTER.x, a.pos.y - CENTER.y) - Math.hypot(b.pos.x - CENTER.x, b.pos.y - CENTER.y)), [w]);
  return <>{list.map((c, i) => <ChargerBeacon key={c.id} idx={i} light={i < 4 && !day} day={day} p={toV(c.pos)} color={STATUS[level(c)]} />)}</>;
}

function EVs({ w, pal }: { w: ReturnType<typeof createWorld>; pal: Pal }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current; if (!m) return;
    w.evs.forEach((c, i) => {
      stepEV(w, c, Math.min(dt, 0.05) * 3);
      o.position.set((c.x - CENTER.x) * S, 0.07, (c.y - CENTER.y) * S);
      o.rotation.set(0, -c.h, 0);
      o.scale.set(0.09, 0.06, 0.045);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, w.evs.length]}>
      <boxGeometry />
      <meshBasicMaterial color={pal.ev} />
    </instancedMesh>
  );
}

function MyCar({ route, pal }: { route: NonNullable<ReturnType<typeof buildRoute>>; pal: Pal }) {
  const car = useRef<THREE.Group>(null);
  const pts = useMemo(() => route.pts.map((p) => toV(p, 0.06)), [route]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.02), [pts]);
  const lineRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.045) % 1;
    const p = curve.getPointAt(t), q = curve.getPointAt(Math.min(1, t + 0.002));
    car.current?.position.copy(p);
    car.current?.lookAt(q.x, p.y, q.z);
    if (lineRef.current?.material) lineRef.current.material.dashOffset = -clock.elapsedTime * 0.8;
  });
  return (
    <>
      <Line points={pts} color={pal.route} lineWidth={14} transparent opacity={0.18} />
      <Line points={pts} color={pal.route} lineWidth={5} transparent opacity={0.95} />
      <Line ref={lineRef} points={pts} color="#ffffff" lineWidth={1.6} dashed dashSize={0.12} gapSize={0.5} transparent opacity={0.85} />
      <group ref={car}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.1, 0.07, 0.2]} />
          <meshStandardMaterial color="#e3173a" emissive="#c8102e" emissiveIntensity={1.4} />
        </mesh>
        <pointLight color="#ff3355" intensity={3} distance={2.5} position={[0, 0.3, 0]} />
        <mesh position={[0, 0.02, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 0.9]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

function Rig({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const { camera, pointer } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * 0.04;
    const sc = scrollRef.current ?? 0; // 0..1 enquanto o hero sai da tela
    const r = 13 - sc * 3;
    const tx = Math.sin(t) * r + pointer.x * 1.6;
    const tz = Math.cos(t) * r + pointer.y * 1.2;
    const ty = 12 + sc * 8 + pointer.y * 0.6;
    camera.position.lerp(camTarget.set(tx, ty, tz), Math.min(1, dt * 1.8));
    look.lerp(lookTarget.set(0, 0, -1 - sc * 2), Math.min(1, dt * 2));
    camera.lookAt(look);
  });
  return null;
}

export default function HeroScene({ scrollRef, active = true, light = false }: { scrollRef: React.RefObject<number>; active?: boolean; light?: boolean }) {
  const { w, route } = useWorld();
  const pal = light ? PAL.light : PAL.dark;
  return (
    <Canvas
      // pausa a renderização quando o hero sai da tela
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      camera={{ position: [0, 12, 16], fov: 36, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}
    >
      {/* key: troca de tema recria fundo/névoa/luzes com as cores novas */}
      <color key={"bg" + pal.bg} attach="background" args={[pal.bg]} />
      <fog key={"fog" + pal.bg} attach="fog" args={[pal.bg, 16, 38]} />
      <hemisphereLight key={"h" + pal.bg} args={[pal.sky, pal.floor, pal.hemi]} />
      <directionalLight position={[8, 14, 6]} intensity={pal.sun} color="#dfe8ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={pal.ground} roughness={1} />
      </mesh>
      <River pal={pal} />
      <Roads w={w} pal={pal} />
      <Buildings w={w} pal={pal} />
      <Chargers w={w} day={light} />
      <EVs w={w} pal={pal} />
      <MyCar route={route} pal={pal} />
      <Rig scrollRef={scrollRef} />
    </Canvas>
  );
}
