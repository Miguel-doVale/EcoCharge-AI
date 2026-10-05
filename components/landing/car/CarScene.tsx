"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import gsap from "gsap";
import * as THREE from "three";
import CarModel, { CAR } from "./CarModel";

export type Phase = "outside" | "entering" | "inside" | "leaving";
export type CarSceneHandle = { enter: () => void; leave: () => void };

const ORBIT_POS = new THREE.Vector3(4.6, 2.0, -4.8);
const ORBIT_LOOK = new THREE.Vector3(0, 0.75, 0);
const DOOR_VIEW = { pos: new THREE.Vector3(0.6, 1.35, -2.6), look: new THREE.Vector3(0.3, 1.0, -0.4) };
// passa pelo vão da porta, acima da soleira e à frente da coluna B
const DOOR_IN = { pos: new THREE.Vector3(0.4, 1.18, -1.05), look: new THREE.Vector3(0.45, 1.1, 0.1) };
const SCREEN_NORMAL = new THREE.Vector3(-1, 0, 0)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), CAR.screen.rotY)
  .add(new THREE.Vector3(0, Math.sin(CAR.screen.tilt), 0)).normalize();
const DASH_VIEW = { pos: CAR.screen.pos.clone().addScaledVector(SCREEN_NORMAL, 0.55), look: CAR.screen.pos.clone() };

export type Cmd = { t: "enter" | "leave"; id: number } | null;
type Props = { phase: Phase; setPhase: (p: Phase) => void; active: boolean; touch: boolean; cmd: Cmd; screenEl: React.RefObject<HTMLDivElement | null>; onReady: () => void };

const Rig = forwardRef<CarSceneHandle, Props & { doorRef: React.RefObject<THREE.Group | null>; setScreenOn: (v: number) => void }>(
  function Rig({ phase, setPhase, touch, doorRef, setScreenOn, onReady }, ref) {
    const { camera } = useThree();
    const controls = useRef<OrbitControlsImpl>(null);
    const cam = useMemo(() => ({ pos: ORBIT_POS.clone(), look: ORBIT_LOOK.clone() }), []);
    const tl = useRef<gsap.core.Timeline | null>(null);
    const reduce = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);

    useEffect(() => { camera.position.copy(ORBIT_POS); camera.lookAt(ORBIT_LOOK); onReady(); }, [camera, onReady]);
    // telas estreitas: abre o campo de visão para o carro inteiro caber de fora
    const { size } = useThree();
    useEffect(() => {
      const pc = camera as THREE.PerspectiveCamera;
      const aspect = size.width / size.height;
      pc.fov = phase === "outside" || phase === "leaving" ? THREE.MathUtils.clamp(36 * (1.5 / Math.max(aspect, 0.4)) ** 0.85, 36, 72) : 36;
      pc.updateProjectionMatrix();
    }, [camera, size, phase]);

    // em telas de toque não há OrbitControls (para não travar o scroll): o carro gira devagar sozinho
    useFrame(({ clock }) => {
      if (phase === "outside") {
        if (touch) {
          const a = -0.82 + Math.sin(clock.elapsedTime * 0.25) * 0.35;
          camera.position.set(Math.cos(a) * 6.6, 2.1, Math.sin(a) * 6.6);
          camera.lookAt(ORBIT_LOOK);
        }
        return;
      }
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
    });

    const to = (t: gsap.core.Timeline, target: { pos: THREE.Vector3; look: THREE.Vector3 }, d: number, at?: gsap.Position) => {
      t.to(cam.pos, { x: target.pos.x, y: target.pos.y, z: target.pos.z, duration: d, ease: "power2.inOut" }, at);
      t.to(cam.look, { x: target.look.x, y: target.look.y, z: target.look.z, duration: d, ease: "power2.inOut" }, "<");
    };
    const door = (t: gsap.core.Timeline, open: boolean, d: number, at?: gsap.Position) =>
      t.to(doorRef.current!.rotation, { y: open ? CAR.doorOpen : 0, duration: d, ease: open ? "power2.out" : "power2.inOut" }, at);

    useImperativeHandle(ref, () => ({
      enter() {
        if (phase !== "outside") return;
        tl.current?.kill();
        cam.pos.copy(camera.position);
        cam.look.copy(controls.current?.target ?? ORBIT_LOOK);
        setPhase("entering");
        const screen = { v: 0 };
        const t = gsap.timeline({ onComplete: () => setPhase("inside") });
        if (reduce) t.timeScale(20);
        door(t, true, 0.9);
        to(t, DOOR_VIEW, 1.3, 0.15);
        to(t, DOOR_IN, 1.0);
        to(t, { pos: CAR.eye, look: CAR.screen.pos }, 1.1);
        door(t, false, 0.9, "-=0.6");
        t.to(screen, { v: 1, duration: 0.6, onUpdate: () => setScreenOn(screen.v) }, "-=0.2");
        to(t, DASH_VIEW, 1.2, "-=0.3");
        tl.current = t;
      },
      leave() {
        if (phase !== "inside") return;
        tl.current?.kill();
        setPhase("leaving");
        const screen = { v: 1 };
        const t = gsap.timeline({
          onComplete: () => {
            controls.current?.target.copy(ORBIT_LOOK);
            controls.current?.update();
            setPhase("outside");
          },
        });
        if (reduce) t.timeScale(20);
        t.to(screen, { v: 0, duration: 0.4, onUpdate: () => setScreenOn(screen.v) });
        to(t, { pos: CAR.eye, look: CAR.screen.pos }, 0.9, 0);
        door(t, true, 0.8, "-=0.2");
        to(t, DOOR_IN, 0.8, "-=0.3");
        to(t, DOOR_VIEW, 0.9);
        to(t, { pos: ORBIT_POS, look: ORBIT_LOOK }, 1.4);
        door(t, false, 0.9, "-=0.9");
        tl.current = t;
      },
    }), [phase, camera, cam, setPhase, doorRef, setScreenOn, reduce]);

    return touch ? null : (
      <OrbitControls
        ref={controls} target={ORBIT_LOOK} enabled={phase === "outside"} enablePan={false} enableZoom={false}
        minPolarAngle={0.9} maxPolarAngle={1.45} enableDamping dampingFactor={0.08} rotateSpeed={0.6}
      />
    );
  }
);

/** Projeta a tela central 3D em pixels e posiciona o elemento DOM (iframe do navegador) por cima.
 *  Na vista final a câmera olha a tela de frente, então a projeção é um retângulo. */
const SCREEN_CSS = { w: 1280, h: 800 };
function ScreenTracker({ el, on }: { el: React.RefObject<HTMLDivElement | null>; on: boolean }) {
  const { camera, size } = useThree();
  const corners = useMemo(() => {
    const s = CAR.screen;
    const g = new THREE.Object3D(); g.position.copy(s.pos); g.rotation.set(0, -Math.PI / 2 + s.rotY, 0);
    const inner = new THREE.Object3D(); inner.rotation.set(-s.tilt, 0, 0); g.add(inner); g.updateMatrixWorld(true);
    return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => new THREE.Vector3((x * s.w) / 2, (y * s.h) / 2, 0.001).applyMatrix4(inner.matrixWorld));
  }, []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const d = el.current; if (!d) return;
    if (!on) { d.style.visibility = "hidden"; return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of corners) {
      v.copy(c).project(camera);
      const px = (v.x * 0.5 + 0.5) * size.width, py = (-v.y * 0.5 + 0.5) * size.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    d.style.visibility = "visible";
    d.style.transform = `translate(${x0}px, ${y0}px) scale(${(x1 - x0) / SCREEN_CSS.w}, ${(y1 - y0) / SCREEN_CSS.h})`;
  });
  return null;
}

export default function CarScene(props: Props) {
  const { phase, active, cmd, screenEl } = props;
  const doorRef = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [screenOn, setScreenOn] = useState(0);
  const rig = useRef<CarSceneHandle>(null);
  useEffect(() => { if (cmd) rig.current?.[cmd.t](); }, [cmd]);
  useEffect(() => { document.body.style.cursor = hover && phase === "outside" ? "pointer" : ""; return () => { document.body.style.cursor = ""; }; }, [hover, phase]);

  return (
    <Canvas
      shadows dpr={[1, 1.5]} frameloop={active ? "always" : "never"}
      camera={{ position: ORBIT_POS.toArray(), fov: 36, near: 0.03, far: 80 }}
      gl={{ antialias: true }}
      onCreated={({ gl, scene }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; scene.background = new THREE.Color("#0c1015"); scene.fog = new THREE.Fog("#0c1015", 9, 22); }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 7, -3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0.2, 1.35, 0]} intensity={phase === "outside" ? 0.4 : 0.7} distance={2.4} color="#e9fff8" />
      {/* reflexos gerados localmente (sem baixar HDR) */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color="#b8ff3c" />
        <Lightformer form="rect" intensity={2} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color="#7fb8ff" />
        <Lightformer form="ring" intensity={1.5} position={[0, 3, -6]} scale={3} />
      </Environment>

      <CarModel
        doorRef={doorRef} hover={hover} onDoorHover={setHover} screenOn={screenOn}
        interactive={phase === "outside"} onDoorClick={() => rig.current?.enter()}
      />
      <ScreenTracker el={screenEl} on={phase === "inside"} />

      {/* "palco": luz no chão para destacar a silhueta */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[4.2, 64]} />
        <meshBasicMaterial color="#141a20" transparent opacity={0.9} />
      </mesh>
      <spotLight position={[0, 6, 0]} angle={0.6} penumbra={0.8} intensity={30} color="#dfe9f2" />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.7} scale={9} blur={2.4} far={2} resolution={512} color="#000" frames={1} />
      <Grid
        position={[0, 0, 0]} args={[40, 40]} cellSize={0.5} cellThickness={0.6} cellColor="#1a2027"
        sectionSize={2.5} sectionThickness={1} sectionColor="#24303a" fadeDistance={18} fadeStrength={1.5} infiniteGrid
      />
      <Rig ref={rig} {...props} doorRef={doorRef} setScreenOn={setScreenOn} />
    </Canvas>
  );
}
