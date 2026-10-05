"use client";

/* Hatch elétrico compacto, estilizado e sem marca (inspirado em hatches como o Dolphin).
   Unidades em metros. Frente = +x, cima = +y, lado do motorista = -z.
   O carro fica na origem e sem rotação: pintura em dois tons, vão da porta e recortes da
   cabine usam a posição no mundo dentro dos shaders. */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { ArchTrim, BodyDetails, SIDE_Z, Wheel } from "./CarDetails";
import CarInterior from "./CarInterior";

/* ---------- medidas principais ---------- */
const DOOR = { x0: -0.05, x1: 1.18, y0: 0.38, y1: 0.99, arcC: [1.35, 0.34] as const, arcR: 0.49, r: 0.025, t: 0.05 };
const GLASS_Z = 0.7; // face lateral da estufa (vidros)
const BELT_Y = 1.07; // topo da linha de cintura

export const CAR = {
  hinge: new THREE.Vector3(DOOR.x1, 0, -SIDE_Z), // dobradiça da porta do motorista (face externa)
  doorOpen: -1.2,
  screen: { pos: new THREE.Vector3(0.6, 1.17, 0.02), w: 0.3, h: 0.1875, rotY: -0.16, tilt: 0.1 },
  eye: new THREE.Vector3(-0.3, 1.2, -0.38),
};

/* cores da pintura */
const PAINT_TOP = "#f2f4f3"; // branco perolado
const PAINT_LOW = "#d4d8db"; // cinza bem claro

/* ---------- shaders ---------- */
const f = (n: number) => n.toFixed(3);
const DOOR_GLSL = `
  bool inDoor(vec3 p, float g) {
    if (p.x < ${f(DOOR.x0)} - g || p.x > ${f(DOOR.x1)} + g) return false;
    if (p.y < ${f(DOOR.y0)} - g || p.y > ${f(DOOR.y1)} + g) return false;
    return distance(p.xy, vec2(${f(DOOR.arcC[0])}, ${f(DOOR.arcC[1])})) > ${f(DOOR.arcR)} - g;
  }`;

function injectWorld(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);");
}

function paintMaterial(body = false) {
  const m = new THREE.MeshPhysicalMaterial({ color: PAINT_TOP, roughness: 0.26, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLower = { value: new THREE.Color(PAINT_LOW) };
    injectWorld(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nuniform vec3 uLower;\n${DOOR_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        ${body ? `
        // cabine oca: sem a tampa superior da carroceria sob os vidros
        if (vWNormal.y > 0.8 && vWPos.y > 0.95 && vWPos.x > -1.75 && vWPos.x < 1.22 && abs(vWPos.z) < 0.72) discard;
        // vão da porta do motorista + faixa da cintura acima dele (ambos vão junto com a porta)
        if (vWPos.z < -${f(SIDE_Z - 0.005)} && inDoor(vWPos, 0.004)) discard;
        if (vWPos.z < -0.715 && vWPos.x > ${f(DOOR.x0 - 0.004)} && vWPos.x < ${f(DOOR.x1 + 0.004)} && vWPos.y > 0.986) discard;` : ""}
        // vinco em onda subindo para a traseira; abaixo dele, cinza claro
        float crease = 0.6 + 0.11 * smoothstep(1.5, -1.8, vWPos.x) + 0.018 * sin(vWPos.x * 2.4);
        float t = smoothstep(crease - 0.003, crease + 0.003, vWPos.y);
        diffuseColor.rgb = mix(uLower, diffuseColor.rgb, t);
        diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.005, abs(vWPos.y - crease)));`
      );
  };
  m.customProgramCacheKey = () => `paint-${body}`;
  return m;
}

const GLASS = { color: "#26323d", roughness: 0.02, metalness: 0.65, transparent: true, opacity: 0.88, side: THREE.DoubleSide, clearcoat: 1, envMapIntensity: 2.4, depthWrite: false } as const;
function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial(GLASS);
  m.onBeforeCompile = (sh) => {
    injectWorld(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vWNormal.y < -0.6) discard; // sem "fundo" na estufa
        if (vWNormal.z < -0.6 && vWPos.x > -0.07 && vWPos.x < 1.31 && vWPos.y > 1.0) discard; // janela do motorista é da porta
        // faixa da estufa abaixo da cintura (escondida pela lataria; aparecia como traço preto com a porta aberta)
        if (vWPos.z < -0.6 && vWPos.x > -0.07 && vWPos.x < 1.22 && vWPos.y < ${f(BELT_Y + 0.005)}) discard;`
      );
  };
  m.customProgramCacheKey = () => "glass-cut";
  return m;
}

/* ---------- perfis ---------- */
function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.05, 0.34);
  s.lineTo(-1.8, 0.34);
  s.absarc(-1.35, 0.34, 0.45, Math.PI, 0, true);
  s.lineTo(0.9, 0.34);
  s.absarc(1.35, 0.34, 0.45, Math.PI, 0, true);
  s.lineTo(2.02, 0.34);
  s.quadraticCurveTo(2.15, 0.36, 2.15, 0.56);
  s.lineTo(2.13, 0.74);
  s.quadraticCurveTo(2.1, 0.9, 1.85, 0.94);
  s.quadraticCurveTo(1.55, 0.98, 1.25, 1.0);
  s.lineTo(-1.95, 1.0);
  s.quadraticCurveTo(-2.12, 0.99, -2.12, 0.85);
  s.lineTo(-2.12, 0.5);
  s.quadraticCurveTo(-2.12, 0.34, -2.05, 0.34);
  return s;
}
function cabinShape() {
  const s = new THREE.Shape();
  s.moveTo(1.3, 0.99);
  s.quadraticCurveTo(0.75, 1.36, 0.3, 1.5);
  s.quadraticCurveTo(-0.6, 1.57, -1.6, 1.53);
  s.quadraticCurveTo(-2.0, 1.5, -2.06, 1.1);
  s.lineTo(-2.06, 0.99);
  s.closePath();
  return s;
}
function roofShape() {
  const s = new THREE.Shape();
  s.moveTo(0.25, 1.49);
  s.quadraticCurveTo(-0.6, 1.56, -1.6, 1.52);
  s.lineTo(-1.65, 1.57);
  s.quadraticCurveTo(-0.6, 1.61, 0.22, 1.54);
  s.closePath();
  return s;
}
/** contorno da porta = retângulo menos o arco da roda dianteira (mesma regra do recorte no shader) */
function doorShape(inset = 0) {
  const { x0, x1, y0, y1, arcC, arcR } = DOOR;
  const r = DOOR.r, R = arcR + inset;
  const X0 = x0 + inset, X1 = x1 - inset, Y0 = y0 + inset, Y1 = y1 - inset;
  const s = new THREE.Shape();
  const aStart = Math.PI - Math.asin((Y0 - arcC[1]) / R);
  const aEnd = Math.acos((X1 - arcC[0]) / R);
  s.moveTo(X0 + r, Y0);
  s.lineTo(arcC[0] + R * Math.cos(aStart), Y0);
  s.absarc(arcC[0], arcC[1], R, aStart, aEnd, true);
  s.lineTo(X1, Y1 - r);
  s.quadraticCurveTo(X1, Y1, X1 - r, Y1);
  s.lineTo(X0 + r, Y1);
  s.quadraticCurveTo(X0, Y1, X0, Y1 - r);
  s.lineTo(X0, Y0 + r);
  s.quadraticCurveTo(X0, Y0, X0 + r, Y0);
  return s;
}
/** recorta um polígono pelos semiplanos x >= xmin, x <= xmax, y >= ymin (Sutherland–Hodgman) */
function clip(poly: THREE.Vector2[], keep: (p: THREE.Vector2) => number) {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = keep(a), db = keep(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) out.push(a.clone().lerp(b, da / (da - db)));
  }
  return out;
}
/** janela do motorista: mesmo contorno da estufa, entre a coluna B e o para-brisa, acima da cintura */
function doorWindowPoints() {
  let p = cabinShape().getPoints(48);
  p = clip(p, (v) => v.x - (DOOR.x0 - 0.02));
  p = clip(p, (v) => 1.31 - v.x);
  p = clip(p, (v) => v.y - BELT_Y);
  return p;
}
/** faixa da cintura que vai junto com a porta (corte em z/y, extrudado ao longo de x) */
function shoulderShape() {
  const s = new THREE.Shape(); // u = z + SIDE_Z (0 = face externa), v = y
  s.moveTo(0, 0.986);
  s.lineTo(0, 1.0);
  s.quadraticCurveTo(0, BELT_Y, 0.08, BELT_Y);
  s.lineTo(SIDE_Z - 0.716, BELT_Y);
  s.lineTo(SIDE_Z - 0.716, 0.986);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number, bevelT = bevel, segs = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevelT, bevelSegments: segs, curveSegments: 64 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Tela central de 12,8" sobre um suporte acima do painel (o navegador real é sobreposto em DOM). */
export function Screen({ on }: { on: number }) {
  const s = CAR.screen;
  return (
    <group position={s.pos} rotation={[0, -Math.PI / 2 + s.rotY, 0]}>
      <group rotation={[-s.tilt, 0, 0]}>
        <RoundedBox args={[s.w + 0.018, s.h + 0.018, 0.022]} radius={0.009} position={[0, 0, -0.0125]}>
          <meshStandardMaterial color="#0b0d10" roughness={0.35} metalness={0.5} />
        </RoundedBox>
        <mesh>
          <planeGeometry args={[s.w, s.h]} />
          <meshBasicMaterial color={new THREE.Color("#05080b").lerp(new THREE.Color("#12403d"), on * 0.6)} toneMapped={false} />
        </mesh>
        <mesh position={[0, -s.h / 2 - 0.03, -0.04]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.07, 0.09, 0.025]} />
          <meshStandardMaterial color="#14171b" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

type Props = {
  doorRef: React.RefObject<THREE.Group | null>;
  hover: boolean;
  onDoorClick: () => void;
  onDoorHover: (v: boolean) => void;
  interactive: boolean;
  screenOn: number;
};

export default function CarModel({ doorRef, hover, onDoorClick, onDoorHover, interactive, screenOn }: Props) {
  const mats = useMemo(() => ({
    body: paintMaterial(true),
    door: paintMaterial(false),
    glass: glassMaterial(),
    doorGlass: new THREE.MeshPhysicalMaterial(GLASS),
    black: new THREE.MeshPhysicalMaterial({ color: "#0d0f12", roughness: 0.25, metalness: 0.4, clearcoat: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: "#262b31", roughness: 0.9, envMapIntensity: 0.3 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: "#e6ebef", metalness: 1, roughness: 0.15 }),
  }), []);
  const geo = useMemo(() => {
    const win = doorWindowPoints();
    const shoulder = new THREE.ExtrudeGeometry(shoulderShape(), { depth: DOOR.x1 - DOOR.x0, bevelEnabled: false, curveSegments: 16 });
    shoulder.rotateY(-Math.PI / 2); // extrusão passa a correr em -x (da dobradiça para trás)
    shoulder.computeVertexNormals();
    return {
      body: extrude(bodyShape(), 1.62, 0.07, 0.08),
      cabin: extrude(cabinShape(), 1.3, 0.05),
      roof: extrude(roofShape(), 1.36, 0.03),
      door: extrude(doorShape(), DOOR.t, 0.004, 0.004, 3).translate(-DOOR.x1, 0, DOOR.t / 2),
      doorTrim: new THREE.ShapeGeometry(doorShape(0.03), 32).translate(-DOOR.x1, 0, 0),
      shoulder,
      window: new THREE.ShapeGeometry(new THREE.Shape(win)).translate(-DOOR.x1, 0, 0),
      doorOutline: doorShape().getPoints(24).map((v) => new THREE.Vector3(v.x - DOOR.x1, v.y, 0)),
      windowFrame: win.map((v) => new THREE.Vector3(v.x - DOOR.x1, v.y, 0)).concat([new THREE.Vector3(win[0].x - DOOR.x1, win[0].y, 0)]),
    };
  }, []);
  const glow = useRef<Line2 | LineSegments2>(null);
  useFrame(({ clock }) => {
    const m = glow.current?.material as THREE.Material | undefined;
    if (m) m.opacity = interactive ? (hover ? 1 : 0.35 + 0.35 * Math.sin(clock.elapsedTime * 3)) : 0;
  });
  const doorEvents = {
    onClick: (e: { stopPropagation: () => void }) => { if (!interactive) return; e.stopPropagation(); onDoorClick(); },
    onPointerOver: (e: { stopPropagation: () => void }) => { if (!interactive) return; e.stopPropagation(); onDoorHover(true); },
    onPointerOut: () => onDoorHover(false),
  };

  return (
    <group>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.cabin} material={mats.glass} renderOrder={2} />
      <mesh geometry={geo.roof} material={mats.black} castShadow />

      {/* frisos cromados da cintura e colunas */}
      {[-GLASS_Z - 0.015, GLASS_Z + 0.015].map((z) => (
        <group key={z}>
          {/* do lado do motorista o trecho da porta é filho da porta */}
          <mesh position={z < 0 ? [-1.04, BELT_Y + 0.004, z] : [-0.42, BELT_Y + 0.004, z]} material={mats.chrome}>
            <boxGeometry args={[z < 0 ? 1.96 : 3.2, 0.012, 0.012]} />
          </mesh>
          <mesh position={[-0.07, 1.29, z]} rotation={[0, 0, -0.06]} material={mats.black}><boxGeometry args={[0.07, 0.44, 0.012]} /></mesh>
          <mesh position={[-1.13, 1.27, z]} rotation={[0, 0, 0.05]} material={mats.black}><boxGeometry args={[0.05, 0.42, 0.012]} /></mesh>
        </group>
      ))}

      <BodyDetails />
      {[[1.35, -1], [1.35, 1], [-1.35, -1], [-1.35, 1]].map(([x, sd]) => (
        <group key={`${x}${sd}`}>
          <Wheel x={x} z={sd * 0.79} />
          <ArchTrim x={x} z={sd * (SIDE_Z + 0.001)} />
        </group>
      ))}

      {/* porta do motorista: painel + faixa da cintura + janela, tudo girando na dobradiça */}
      <group ref={doorRef} position={CAR.hinge}>
        <mesh geometry={geo.door} material={mats.door} castShadow {...doorEvents} />
        <mesh geometry={geo.shoulder} material={mats.door} {...doorEvents} />
        <mesh position={[-(DOOR.x1 - DOOR.x0) / 2, BELT_Y + 0.004, SIDE_Z - GLASS_Z - 0.015]} material={mats.chrome}>
          <boxGeometry args={[DOOR.x1 - DOOR.x0, 0.012, 0.012]} />
        </mesh>
        <group position={[0, 0, SIDE_Z - GLASS_Z - 0.003]}>
          <mesh geometry={geo.window} material={mats.doorGlass} renderOrder={2} />
          <Line points={geo.windowFrame} color="#0b0d10" lineWidth={2.2} />
        </group>
        {/* forro interno */}
        <mesh geometry={geo.doorTrim} position={[0, 0, DOOR.t + 0.002]} material={mats.trim} />
        <RoundedBox args={[0.6, 0.035, 0.07]} radius={0.015} position={[-0.55, 0.76, DOOR.t + 0.035]}>
          <meshStandardMaterial color="#4a5058" roughness={0.9} />
        </RoundedBox>
        <mesh position={[-0.6, 0.925, DOOR.t + 0.004]}><boxGeometry args={[0.9, 0.004, 0.004]} /><meshBasicMaterial color="#2fd3c0" toneMapped={false} /></mesh>
        <mesh position={[-0.32, 0.86, DOOR.t + 0.012]}><boxGeometry args={[0.08, 0.02, 0.015]} /><meshStandardMaterial color="#aab1b8" metalness={0.9} roughness={0.25} /></mesh>
        {/* maçaneta embutida */}
        <mesh position={[-1.02, 0.9, -0.002]}>
          <boxGeometry args={[0.15, 0.022, 0.006]} />
          <meshPhysicalMaterial color="#16191c" metalness={0.6} roughness={0.3} clearcoat={1} />
        </mesh>
        {/* contorno pulsante indicando que dá para tocar */}
        <Line ref={glow} points={geo.doorOutline} color="#b8ff3c" lineWidth={2.5} transparent opacity={0} position={[0, 0, -0.008]} />
      </group>

      <CarInterior />
      <Screen on={screenOn} />
    </group>
  );
}
