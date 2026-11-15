"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { sample, scheduleIdle, TAP, type Act, type Beat } from "./motion";
import {
  bounds,
  CORD_RINGS,
  CORD_SIDES,
  displayScale,
  FEATURE_MARK,
  layout,
  mix,
  params,
  rotZ,
  STILL,
  TUBE_RINGS,
  TUBE_SIDES,
  turnAngle,
  type Area,
  type Layout,
  type Mark,
  type Params,
  type Part,
  type Ring,
  type Vec3,
} from "./model";

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
  /** The acting parent's accent for the selected dot (CSS colors). */
  accent: { me: string; mid: string } | null;
};

const SKIN = "#FBD5BE";
/** The early embryo: rosier and glossier, as if lit through. Blends to SKIN by p.skin. */
const EMBRYO = "#F3A493";
const HAIR = "#8A5B40";
const YOLK = "#F5D27E";
/** Vernix pulls the skin toward this cream. */
const VERNIX = "#FBEEE2";
/** At most this many sparkles when a new week adds features. */
const SPARKS = 4;
const BLUSH = "#EE9B83";
const INK = "#3A2C24";
/** World units for a full-size (week 40) baby's largest extent. */
const WORLD = 2.1;
const FOV = 32;
const Z: Vec3 = [0, 0, 1];

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

function Baby({ week, lengthCm, lengthMeasure, areas, selected, onSelect, reducedMotion, paused, accent }: SceneProps) {
  const { invalidate, camera, size: viewport, clock } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const dots = useRef<(THREE.Group | null)[]>([]);
  const glows = useRef<(THREE.Group | null)[]>([]);
  const heartGlow = useRef<THREE.Sprite>(null);
  const beats = useRef<Beat[]>([]);
  const nextIdle = useRef<Partial<Record<Act, number>>>({});
  const sparkSprites = useRef<(THREE.Sprite | null)[]>([]);
  const sparks = useRef<{ mark: Mark; at: number }[]>([]);
  const lastWeekP = useRef<Params | null>(null);

  // Morph state lives in refs: React renders only when the week or selection changes.
  const target = useMemo(() => ({ p: params(week), scale: displayScale(lengthCm, lengthMeasure) }), [week, lengthCm, lengthMeasure]);
  const current = useRef<{ p: Params; scale: number } | null>(null);
  const arrivedAt = useRef(0);
  const lastTouch = useRef(-10);
  const rig = useRef<{ dir: THREE.Vector3 | null; target: THREE.Vector3; dist: number; active: boolean }>({
    dir: null,
    target: new THREE.Vector3(0, -0.12, 0),
    dist: 4.6,
    active: true,
  });
  const tubeFor = useRef<Params | null>(null);
  const lastLayout = useRef<{ lay: Layout; center: Vec3; k: number; rot: number } | null>(null);

  // The parts list has a fixed shape for every week, so one mesh per slot.
  const template = useMemo(() => layout(params(20)).parts, []);
  const geo = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(1, 48, 32),
      eye: new THREE.TorusGeometry(1, 0.21, 10, 28, Math.PI),
      mouth: new THREE.TorusGeometry(1, 0.32, 10, 24, Math.PI),
      dot: new THREE.SphereGeometry(1, 20, 14),
      tube: tubeGeometry(TUBE_RINGS, TUBE_SIDES),
      cord: tubeGeometry(CORD_RINGS, CORD_SIDES),
    }),
    [],
  );
  const wrinkles = useMemo(() => wrinkleTexture(), []);
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({
        color: SKIN,
        roughness: 0.72,
        sheen: 0.7,
        sheenColor: new THREE.Color("#FFE3CC"),
        sheenRoughness: 0.55,
        emissive: "#E2654E",
        emissiveIntensity: 0,
        normalMap: wrinkles,
        normalScale: new THREE.Vector2(0, 0),
      }),
      cord: new THREE.MeshPhysicalMaterial({ color: "#F1DCD9", roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color("#E7E4F6") }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.85 }),
      yolk: new THREE.MeshPhysicalMaterial({ color: YOLK, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: "#E9A94A", emissiveIntensity: 0.12 }),
      shine: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      blush: new THREE.MeshStandardMaterial({ color: BLUSH, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
      ink: new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }),
      dot: new THREE.MeshStandardMaterial({ color: "#FFFDF9", emissive: "#F4CD6A", emissiveIntensity: 0.9, roughness: 0.4 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [wrinkles],
  );
  const halo = useMemo(() => haloTexture(), []);
  const spark = useMemo(() => sparkTexture(), []);
  const ring = useMemo(() => ringTexture(), []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mat).forEach((m) => m.dispose());
      halo.dispose();
      spark.dispose();
      ring.dispose();
      wrinkles.dispose();
    },
    [geo, mat, halo, spark, ring, wrinkles],
  );

  // A new week: the dots pulse once and the camera eases back to the whole baby.
  // Features that just formed (fingers, open eyes, hair) sparkle where they are.
  useEffect(() => {
    arrivedAt.current = performance.now() / 1000;
    const before = lastWeekP.current;
    const now = params(week);
    lastWeekP.current = now;
    if (before && !reducedMotion) {
      const grown = (Object.keys(FEATURE_MARK) as (keyof Params)[])
        .map((f) => [f, now[f] - before[f]] as const)
        .filter(([, d]) => d > 0.2)
        .sort((a, b) => b[1] - a[1]);
      const marks = [...new Set(grown.flatMap(([f]) => FEATURE_MARK[f] ?? []))].slice(0, SPARKS);
      // After the morph is mostly there, one after another.
      sparks.current = marks.map((mark, i) => ({ mark, at: clock.elapsedTime + 0.35 + i * 0.18 }));
    }
    rig.current.active = true;
    invalidate();
  }, [week, invalidate, reducedMotion, clock]);

  // Selecting a hotspot turns the camera gently toward it; clearing returns to the whole baby.
  useEffect(() => {
    const r = rig.current;
    const last = lastLayout.current;
    if (selected != null && last && areas[selected]) {
      const a = last.lay.anchors[areas[selected]];
      const n = new THREE.Vector3(...rotZ(a.normal, last.rot));
      // Never look from straight below, and keep a little of the current angle.
      n.y = Math.max(n.y, -0.15);
      r.dir = n.normalize().lerp(camera.position.clone().normalize(), 0.25).normalize();
      r.target.set(...toWorld(a.pos, last)).multiplyScalar(0.55);
      // The part shows what its card says it can do: the hand grips, the leg kicks.
      // Starts a moment later, once the camera has turned toward it. From the dot or the list.
      const act = TAP[areas[selected]];
      if (act && !reducedMotion) {
        beats.current = beats.current.filter((b) => b.act !== act);
        beats.current.push({ act, at: clock.elapsedTime + 0.45 });
      }
    } else {
      r.dir = null;
      // Aim a little low so the baby sits above the size label in the corner.
      r.target.set(0, -0.12, 0);
    }
    r.active = true;
    invalidate();
  }, [selected, areas, camera, invalidate, clock, reducedMotion]);

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
      // Any param still off by more than a hair keeps the morph going.
      moving = Math.abs(cur.scale - target.scale) > 0.0005 || (Object.keys(target.p) as (keyof Params)[]).some((key) => Math.abs(cur.p[key] - target.p[key]) > 0.0005);
      // Settled: snap, so the body is rebuilt only while it actually changes.
      if (!moving) cur.p = target.p;
    }
    // Movement: idle by stage, plus whatever a tap started. None under reduced motion.
    if (!reducedMotion && !paused) scheduleIdle(beats.current, nextIdle.current, cur.p, now);
    const life = sample(beats.current, now, cur.p);
    if (reducedMotion) Object.assign(life, { m: STILL, jolt: 0, breath: 0, glow: 0 });
    const lay = layout(cur.p, life.m);
    const rot = turnAngle(cur.p);
    const b = bounds(lay, rot);
    const k = (WORLD * cur.scale) / b.size;
    const frame = { lay, center: b.center, k, rot };
    lastLayout.current = frame;

    // Gentle float, like the bob on the illustrations. Off under reduced motion.
    // Hiccups add a small hop on top.
    const bob = reducedMotion ? 0 : Math.sin(now * ((2 * Math.PI) / 4.8)) * 0.025 + life.jolt * 0.035 * cur.scale;
    if (group.current) {
      group.current.position.set(-b.center[0] * k, -b.center[1] * k + bob, -b.center[2] * k);
      // Late in pregnancy the baby turns head down, around the axis it curls about.
      group.current.rotation.z = rot;
      // Practice breathing: the body swells a touch across, not along.
      group.current.scale.set(k * (1 + 0.025 * life.breath), k, k * (1 + 0.04 * life.breath));
    }
    if (heartGlow.current) {
      const [x, y, z] = toWorld(lay.anchors.heart.pos, frame);
      heartGlow.current.position.set(x, y + bob, z);
      heartGlow.current.scale.setScalar(0.5 * life.glow * (0.6 + 0.4 * cur.scale));
      heartGlow.current.visible = life.glow > 0.01;
    }
    lay.parts.forEach((part, i) => setMatrix(meshes.current[i], part));
    if (tubeFor.current !== cur.p) {
      updateTube(geo.tube, lay.tube, TUBE_SIDES, 1.1);
      updateTube(geo.cord, lay.cord, CORD_SIDES, 1);
      tubeFor.current = cur.p;
      tintSkin(mat.skin, cur.p);
    }
    if (shadow.current) shadow.current.position.y = -(WORLD * cur.scale) * 0.5 - 0.08;

    // Hotspot dots: constant size on screen, one pulse when the week arrives.
    const since = performance.now() / 1000 - arrivedAt.current;
    const pulsing = !reducedMotion && since < 1.1;
    areas.forEach((area, i) => {
      const d = dots.current[i];
      if (!d) return;
      const a = lay.anchors[area];
      const [x, y, z] = toWorld(a.pos, frame);
      d.position.set(x, y + bob, z);
      const pulse = pulsing ? 1 + 0.8 * Math.sin(Math.PI * Math.min(1, Math.max(0, (since - i * 0.08) / 0.9))) : 1;
      // Much smaller on a tiny embryo, so four dots do not swallow it.
      glows.current[i]?.scale.setScalar(pulse * (0.28 + 0.72 * cur.scale));
    });

    // New-feature sparkles: a quick twinkle that grows, turns and fades.
    let sparkling = false;
    for (let i = 0; i < SPARKS; i++) {
      const sp = sparkSprites.current[i];
      if (!sp) continue;
      const s = sparks.current[i];
      const u = s ? (now - s.at) / 1.4 : -1;
      sp.visible = u > 0 && u < 1;
      if (!s || !sp.visible) continue;
      sparkling = true;
      const [x, y, z] = toWorld(lay.marks[s.mark], frame);
      sp.position.set(x, y + bob, z);
      sp.scale.setScalar(0.48 * Math.sin(Math.PI * u) * (0.5 + 0.5 * cur.scale));
      sp.material.rotation = u * 1.2;
      sp.material.opacity = Math.min(1, 2.5 * (1 - u));
    }
    if (sparks.current.length && !sparkling && sparks.current.every((s) => now > s.at + 1.4)) sparks.current = [];

    // Camera: ease the distance with the baby's size, and toward a selected hotspot.
    const c = controls.current;
    const r = rig.current;
    if (c && r.active) {
      // Step back on narrow canvases (phones) so the baby stays clear of the size label.
      const narrow = Math.max(1, 1.25 / (viewport.width / viewport.height));
      const dist = (selected != null ? 2.4 + 1.4 * cur.scale : 2.6 + 2.2 * cur.scale) * narrow;
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
        <mesh geometry={geo.cord} material={mat.cord} />
        {template.map((part, i) => (
          <mesh
            key={i}
            ref={(m) => {
              meshes.current[i] = m;
            }}
            matrixAutoUpdate={false}
            geometry={part.arc === "lid" ? geo.eye : part.arc === "smile" ? geo.mouth : geo.sphere}
            material={mat[part.tone]}
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
            {/* Selected: an open ring in the parent's accent, so the part it marks stays in view. */}
            <mesh geometry={geo.dot} material={mat.dot} scale={0.05} visible={selected !== i} />
            <sprite scale={0.36} visible={selected !== i}>
              <spriteMaterial map={halo} color="#F4CD6A" transparent depthWrite={false} opacity={1} />
            </sprite>
            <sprite scale={0.2} visible={selected === i}>
              <spriteMaterial map={ring} color={accent?.me || "#C4603A"} transparent depthWrite={false} depthTest={false} />
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
      {Array.from({ length: SPARKS }, (_, i) => (
        <sprite
          key={i}
          visible={false}
          ref={(sp) => {
            sparkSprites.current[i] = sp;
          }}
        >
          <spriteMaterial map={spark} color="#FFF4D6" transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
      <sprite ref={heartGlow} visible={false}>
        <spriteMaterial map={halo} color="#F07A6A" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <group ref={shadow}>
        <ContactShadows opacity={0.32} scale={4} blur={2.6} far={1.6} resolution={256} color="#9A5A3C" />
      </group>
    </>
  );
}

/** A tube's index buffer and UVs never change; positions are written by updateTube. */
function tubeGeometry(rings: number, sides: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rings * sides * 3), 3));
  // UVs only feed the skin's wrinkle map: around the body once, along it four times.
  const uv = new Float32Array(rings * sides * 2);
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      uv.set([j / sides, (4 * i) / rings], (i * sides + j) * 2);
      if (i === rings - 1) continue;
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      index.push(a, c, b, b, c, d);
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** wide stretches the cross-section along side, so the body reads as a body and not a pipe. */
function updateTube(g: THREE.BufferGeometry, rings: Ring[], sides: number, wide: number) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  rings.forEach((ring, i) => {
    const side = ring.side ?? Z;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      // Somite bumps sit on the back half only (cos a > 0 points to the back).
      const cx = Math.cos(a) * (ring.r + ring.bump * ring.r * Math.max(0, Math.cos(a)) ** 2);
      const sz = Math.sin(a) * ring.r * wide;
      const o = (i * sides + j) * 3;
      arr[o] = ring.c[0] + ring.out[0] * cx + side[0] * sz;
      arr[o + 1] = ring.c[1] + ring.out[1] * cx + side[1] * sz;
      arr[o + 2] = ring.c[2] + ring.out[2] * cx + side[2] * sz;
    }
  });
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

const embryoColor = new THREE.Color(EMBRYO);
const skinColor = new THREE.Color(SKIN);
/** Skin by stage: rosy and a little glossy early, settling into opaque peach (t = 1). */
const vernixColor = new THREE.Color(VERNIX);
const fuzzColor = new THREE.Color("#FFF4EA");
const sheenColor = new THREE.Color("#FFE3CC");
/**
 * Skin by stage: rosy and a little glossy early, settling into opaque peach.
 * Lanugo is a soft fuzz (sheen), vernix a paler satin, and thin skin shows fine
 * wrinkles until the fat fills it out.
 */
function tintSkin(m: THREE.MeshPhysicalMaterial, p: Params) {
  m.color.lerpColors(embryoColor, skinColor, p.skin).lerp(vernixColor, 0.22 * p.vernix);
  m.roughness = 0.5 + 0.22 * p.skin + 0.08 * p.vernix;
  m.emissiveIntensity = 0.14 * (1 - p.skin);
  m.sheen = 0.7 + 0.3 * p.lanugo;
  m.sheenRoughness = 0.55 + 0.35 * p.lanugo;
  m.sheenColor.lerpColors(sheenColor, fuzzColor, p.lanugo);
  m.normalScale.setScalar(0.16 * p.wrinkle);
}

/** Model space to world: the head-down turn, then centred and scaled. */
function toWorld(p: Vec3, { center, k, rot }: { center: Vec3; k: number; rot: number }): Vec3 {
  const q = rotZ(p, rot);
  return [(q[0] - center[0]) * k, (q[1] - center[1]) * k, (q[2] - center[2]) * k];
}

const m4 = new THREE.Matrix4();
function setMatrix(mesh: THREE.Mesh | null | undefined, part: Part) {
  if (!mesh) return;
  const [x, y, z] = part.basis;
  if (part.arc) {
    // A half torus is an arch; turned over it is the closed, sleepy eye and the small smile.
    // Eyebrows pass a basis already turned upside down, so they arch the other way.
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

/** A four-point twinkle for new features, drawn once on a small canvas. */
function sparkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(0.25, "rgba(255,255,255,0.25)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#fff";
  g.beginPath();
  // Four long thin points, curved in like a drawn star.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const tip = [64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60];
    const l = [64 + Math.cos(a + Math.PI / 4) * 9, 64 + Math.sin(a + Math.PI / 4) * 9];
    if (i === 0) g.moveTo(l[0], l[1]);
    g.quadraticCurveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8, tip[0], tip[1]);
    g.quadraticCurveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8, l[0], l[1]);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A tiling normal map of fine, soft creases for thin skin, made from a few
 * sine ridges with whole-number frequencies so the edges meet. Drawn once.
 */
function wrinkleTexture() {
  const n = 128;
  const waves = [
    [3, 7, 0.0, 1],
    [-5, 9, 1.3, 0.8],
    [8, 3, 2.1, 0.6],
    [11, -6, 0.7, 0.45],
    [2, 15, 2.9, 0.35],
  ];
  const h = (x: number, y: number) => waves.reduce((acc, [fx, fy, ph, a]) => acc + a * Math.abs(Math.sin(Math.PI * (fx * x + fy * y) + ph)), 0);
  const data = new Uint8Array(n * n * 4);
  const e = 1 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const dx = (h(u + e, v) - h(u - e, v)) * 0.6;
      const dy = (h(u, v + e) - h(u, v - e)) * 0.6;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * n + x) * 4;
      data[o] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** An open ring with a soft outer glow, for the selected hotspot. */
function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 16;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
