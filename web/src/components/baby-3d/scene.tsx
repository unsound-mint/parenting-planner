"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { bounds, displayScale, layout, mix, params, TUBE_RINGS, TUBE_SIDES, type Area, type Layout, type Params, type Part, type Ring, type Vec3 } from "./model";

// The 3D baby. Loaded only on the 3D page, through next/dynamic with ssr off
// (see view.tsx), so three.js never ships with the rest of the app.
//
// Rendering is on demand: a frame is drawn only while something moves (the
// morph, the camera easing, the idle orbit, the pulse), never while the tab or
// the canvas is hidden, and never continuously under reduced motion.

export type SceneProps = {
  week: number;
  lengthCm: number;
  lengthMeasure: string;
  areas: Area[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  reducedMotion: boolean;
  paused: boolean;
};

const SKIN = "#FBD5BE";
const BLUSH = "#EE9B83";
const INK = "#3A2C24";
/** World units for a full-size (week 40) baby's largest extent. */
const WORLD = 2.1;
const FOV = 32;

export default function BabyScene(props: SceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [1.7, 0.55, 4.3], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, powerPreference: "low-power" }}
      // Vertical swipes still scroll the page on phones; horizontal drags rotate.
      style={{ touchAction: "pan-y" }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <hemisphereLight args={["#FFF6EA", "#F0C2A8", 1.5]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.5} color="#FFF1DE" />
      {/* Warm rim from behind: the clay glow along the back and the head. */}
      <directionalLight position={[-3, 1.5, -3.5]} intensity={2.6} color="#FFCF96" />
      <directionalLight position={[3, -1, -2]} intensity={0.8} color="#FFE2C4" />
      <Baby {...props} />
    </Canvas>
  );
}

function Baby({ week, lengthCm, lengthMeasure, areas, selected, onSelect, reducedMotion, paused }: SceneProps) {
  const { invalidate, camera, size: viewport, clock } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const dots = useRef<(THREE.Group | null)[]>([]);
  const glows = useRef<(THREE.Group | null)[]>([]);

  // Morph state lives in refs: React renders only when the week or selection changes.
  const target = useMemo(() => ({ p: params(week), scale: displayScale(lengthCm, lengthMeasure) }), [week, lengthCm, lengthMeasure]);
  const current = useRef<{ p: Params; scale: number } | null>(null);
  const arrivedAt = useRef(0);
  const lastTouch = useRef(-10);
  const rig = useRef<{ dir: THREE.Vector3 | null; target: THREE.Vector3; dist: number; active: boolean }>({
    dir: null,
    target: new THREE.Vector3(),
    dist: 4.6,
    active: true,
  });
  const tubeFor = useRef<Params | null>(null);
  const lastLayout = useRef<{ lay: Layout; center: Vec3; k: number } | null>(null);

  // The parts list has a fixed shape for every week, so one mesh per slot.
  const template = useMemo(() => layout(params(20)).parts, []);
  const geo = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 48, 32),
      eye: new THREE.TorusGeometry(1, 0.21, 10, 28, Math.PI),
      mouth: new THREE.TorusGeometry(1, 0.32, 10, 24, Math.PI),
      dot: new THREE.SphereGeometry(1, 20, 14),
      tube: tubeGeometry(),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: SKIN, roughness: 0.72, sheen: 0.7, sheenColor: new THREE.Color("#FFE3CC"), sheenRoughness: 0.55 }),
      blush: new THREE.MeshStandardMaterial({ color: BLUSH, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
      ink: new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }),
      dot: new THREE.MeshStandardMaterial({ color: "#FFFDF9", emissive: "#F4CD6A", emissiveIntensity: 0.9, roughness: 0.4 }),
      dotOn: new THREE.MeshStandardMaterial({ color: "#C4603A", emissive: "#A04828", emissiveIntensity: 0.5, roughness: 0.4 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  );
  const halo = useMemo(() => haloTexture(), []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mat).forEach((m) => m.dispose());
      halo.dispose();
    },
    [geo, mat, halo],
  );

  // A new week: the dots pulse once and the camera eases back to the whole baby.
  useEffect(() => {
    arrivedAt.current = performance.now() / 1000;
    rig.current.active = true;
    invalidate();
  }, [week, invalidate]);

  // Selecting a hotspot turns the camera gently toward it; clearing returns to the whole baby.
  useEffect(() => {
    const r = rig.current;
    const last = lastLayout.current;
    if (selected != null && last && areas[selected]) {
      const a = last.lay.anchors[areas[selected]];
      const n = new THREE.Vector3(...a.normal);
      // Never look from straight below, and keep a little of the current angle.
      n.y = Math.max(n.y, -0.15);
      r.dir = n.normalize().lerp(camera.position.clone().normalize(), 0.25).normalize();
      r.target.set(...toWorld(a.pos, last.center, last.k)).multiplyScalar(0.55);
    } else {
      r.dir = null;
      r.target.set(0, 0, 0);
    }
    r.active = true;
    invalidate();
  }, [selected, areas, camera, invalidate]);

  useEffect(() => {
    if (!paused) invalidate();
  }, [paused, invalidate]);

  // Hit targets stay about 44 px wide on any canvas size.
  const pxPerUnit = viewport.height / (2 * 4.6 * Math.tan((FOV * Math.PI) / 360));
  const hitR = Math.max(0.1, 22 / pxPerUnit);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    let moving = false;

    // Morph toward the target week.
    const cur = (current.current ??= { p: target.p, scale: target.scale });
    if (reducedMotion) {
      cur.p = target.p;
      cur.scale = target.scale;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      cur.p = mix(cur.p, target.p, k);
      cur.scale += (target.scale - cur.scale) * k;
      moving = Math.abs(cur.scale - target.scale) > 0.0005 || Math.abs(cur.p.headR - target.p.headR) > 0.0005 || Math.abs(cur.p.legLen - target.p.legLen) > 0.0005;
      // Settled: snap, so the body is rebuilt only while it actually changes.
      if (!moving) cur.p = target.p;
    }
    const lay = layout(cur.p);
    const b = bounds(lay);
    const k = (WORLD * cur.scale) / b.size;
    lastLayout.current = { lay, center: b.center, k };

    // Gentle float, like the bob on the illustrations. Off under reduced motion.
    const bob = reducedMotion ? 0 : Math.sin(now * ((2 * Math.PI) / 4.8)) * 0.025;
    if (group.current) {
      group.current.position.set(-b.center[0] * k, -b.center[1] * k + bob, -b.center[2] * k);
      group.current.scale.setScalar(k);
    }
    lay.parts.forEach((part, i) => setMatrix(meshes.current[i], part));
    if (tubeFor.current !== cur.p) {
      updateTube(geo.tube, lay.tube);
      tubeFor.current = cur.p;
    }
    if (shadow.current) shadow.current.position.y = -(WORLD * cur.scale) * 0.5 - 0.08;

    // Hotspot dots: constant size on screen, one pulse when the week arrives.
    const since = performance.now() / 1000 - arrivedAt.current;
    const pulsing = !reducedMotion && since < 1.1;
    areas.forEach((area, i) => {
      const d = dots.current[i];
      if (!d) return;
      const a = lay.anchors[area];
      const [x, y, z] = toWorld(a.pos, b.center, k);
      d.position.set(x, y + bob, z);
      const pulse = pulsing ? 1 + 0.8 * Math.sin(Math.PI * Math.min(1, Math.max(0, (since - i * 0.08) / 0.9))) : 1;
      // Smaller on a tiny embryo, so four dots do not swallow it.
      glows.current[i]?.scale.setScalar(pulse * (selected === i ? 1.25 : 1) * (0.55 + 0.45 * cur.scale));
    });

    // Camera: ease the distance with the baby's size, and toward a selected hotspot.
    const c = controls.current;
    const r = rig.current;
    if (c && r.active) {
      const dist = selected != null ? 2.4 + 1.4 * cur.scale : 2.6 + 2.2 * cur.scale;
      const e = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
      c.target.lerp(r.target, e);
      const offset = camera.position.clone().sub(c.target);
      const len = offset.length();
      const dir = offset.normalize();
      if (r.dir) dir.lerp(r.dir, e).normalize();
      camera.position.copy(c.target).addScaledVector(dir, len + (dist - len) * e);
      const done = Math.abs(len - dist) < 0.004 && c.target.distanceTo(r.target) < 0.004 && (!r.dir || dir.distanceTo(r.dir) < 0.004);
      if (done) r.active = false;
      else moving = true;
    }

    // Idle orbit: after a few quiet seconds, with nothing selected.
    const orbit = !reducedMotion && !paused && selected == null && now - lastTouch.current > 3.5;
    // drei's OrbitControls calls update() itself each frame.
    if (c) c.autoRotate = orbit;
    if (!paused && (moving || pulsing || orbit || !reducedMotion)) invalidate();
  });

  const pick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(selected === i ? null : i);
  };

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        autoRotateSpeed={0.55}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.72}
        onStart={() => {
          lastTouch.current = Number.POSITIVE_INFINITY;
          // A drag takes over: stop turning toward the hotspot, keep easing the distance.
          rig.current.dir = null;
        }}
        onEnd={() => {
          lastTouch.current = clock.getElapsedTime();
        }}
      />
      <group ref={group}>
        <mesh geometry={geo.tube} material={mat.skin} />
        {template.map((part, i) => (
          <mesh
            key={i}
            ref={(m) => {
              meshes.current[i] = m;
            }}
            matrixAutoUpdate={false}
            geometry={part.arc ? (part.radii[0] / Math.max(part.radii[1], 1e-6) > 4 ? geo.eye : geo.mouth) : geo.sphere}
            material={part.tone === "skin" ? mat.skin : part.tone === "blush" ? mat.blush : mat.ink}
            renderOrder={part.tone === "blush" ? 2 : 0}
          />
        ))}
      </group>
      {areas.map((area, i) => (
        <group
          key={`${week}-${i}`}
          ref={(g) => {
            dots.current[i] = g;
          }}
        >
          <group
            ref={(g) => {
              glows.current[i] = g;
            }}
          >
            <mesh geometry={geo.dot} material={selected === i ? mat.dotOn : mat.dot} scale={0.05} />
            <sprite scale={0.36}>
              <spriteMaterial map={halo} color={selected === i ? "#E8A07C" : "#F4CD6A"} transparent depthWrite={false} opacity={1} />
            </sprite>
          </group>
          <mesh
            geometry={geo.dot}
            material={mat.hit}
            scale={hitR}
            onClick={pick(i)}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
            name={area}
          />
        </group>
      ))}
      <group ref={shadow}>
        <ContactShadows opacity={0.32} scale={4} blur={2.6} far={1.6} resolution={256} color="#9A5A3C" />
      </group>
    </>
  );
}

/** The body tube's index buffer never changes; positions are written by updateTube. */
function tubeGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TUBE_RINGS * TUBE_SIDES * 3), 3));
  const index: number[] = [];
  for (let i = 0; i < TUBE_RINGS - 1; i++) {
    for (let j = 0; j < TUBE_SIDES; j++) {
      const a = i * TUBE_SIDES + j;
      const b = i * TUBE_SIDES + ((j + 1) % TUBE_SIDES);
      const c = a + TUBE_SIDES;
      const d = b + TUBE_SIDES;
      index.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(index);
  return g;
}

function updateTube(g: THREE.BufferGeometry, rings: Ring[]) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  rings.forEach((ring, i) => {
    for (let j = 0; j < TUBE_SIDES; j++) {
      const a = (j / TUBE_SIDES) * Math.PI * 2;
      // A touch wider than deep, so the body reads as a body and not a pipe.
      const cx = Math.cos(a) * ring.r;
      const sz = Math.sin(a) * ring.r * 1.1;
      const o = (i * TUBE_SIDES + j) * 3;
      arr[o] = ring.c[0] + ring.out[0] * cx;
      arr[o + 1] = ring.c[1] + ring.out[1] * cx;
      arr[o + 2] = ring.c[2] + ring.out[2] * cx + sz;
    }
  });
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

function toWorld(p: Vec3, center: Vec3, k: number): Vec3 {
  return [(p[0] - center[0]) * k, (p[1] - center[1]) * k, (p[2] - center[2]) * k];
}

const m4 = new THREE.Matrix4();
function setMatrix(mesh: THREE.Mesh | null | undefined, part: Part) {
  if (!mesh) return;
  const [x, y, z] = part.basis;
  if (part.arc) {
    // A half torus is an arch; turned over it is the closed, sleepy eye and the small smile.
    const s = part.radii[0];
    m4.set(-x[0] * s, -y[0] * s, z[0] * s, part.pos[0], -x[1] * s, -y[1] * s, z[1] * s, part.pos[1], -x[2] * s, -y[2] * s, z[2] * s, part.pos[2], 0, 0, 0, 1);
  } else {
    const [a, b, c] = part.radii;
    m4.set(x[0] * a, y[0] * b, z[0] * c, part.pos[0], x[1] * a, y[1] * b, z[1] * c, part.pos[1], x[2] * a, y[2] * b, z[2] * c, part.pos[2], 0, 0, 0, 1);
  }
  mesh.visible = part.radii[0] > 1e-4;
  mesh.matrix.copy(m4);
  mesh.matrixWorldNeedsUpdate = true;
}

/** A soft round glow, drawn once on a small canvas (no image files). */
function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
