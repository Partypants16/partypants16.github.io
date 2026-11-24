// Avatar Lab (avatar-lab.html). Opens a rigged avatar (GLB or VRM) that the visitor picks
// or drops, entirely in the browser: the file is never uploaded, and neither is the
// webcam picture.
//
// What it does with the avatar
// - Finds the humanoid bones by name (Mixamo, Unreal/MakeHuman, VRM, Rigify, Unity-style
//   names all work), so the built-in moves and any humanoid animation file can drive it.
// - Built-in moves are made here in code (idle, walk, run, wave, dance, jump, arms up,
//   T-pose): each frame aims the limbs at directions in the avatar's own space, so they
//   don't depend on how a rig's bones are rolled.
// - Animation files (FBX from Mixamo, GLB packs) are retargeted live: each bone's rotation
//   away from the source's rest pose is applied to the matching bone here, after first
//   lining the two rest poses up (a T-pose clip on an A-pose avatar still works).
// - Face: every morph target (ARKit's 52 names, Meta/Oculus visemes, anything else) gets a
//   slider; presets and lip shapes are built from the ARKit names (or VRM expressions).
// - Webcam: MediaPipe Face Landmarker (vendored in vendor/mediapipe/) gives the 52 ARKit
//   scores and the head's rotation for each video frame, which drive the face and head.
//
// three.js 0.186.1, three-vrm 3.6.0 and MediaPipe tasks-vision 1.2.3 are vendored, so the
// page loads nothing from other sites.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from './vendor/three-vrm/three-vrm.module.min.js';

const $ = id => document.getElementById(id);
$('year').textContent = new Date().getFullYear();

const stage = $('al-stage');
const canvas = $('al-canvas');
const drop = $('al-drop');
const panel = $('al-panel');
const tools = $('al-tools');

// ---------- messages ----------
function showError(text) { const el = $('al-error'); el.textContent = text; el.hidden = false; }
function hideError() { $('al-error').hidden = true; }
function setBusy(on, text) { const el = $('al-busy'); if (text) el.textContent = text; el.hidden = !on; }
function note(id, text) { const el = $(id); el.textContent = text || ''; el.hidden = !text; }
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

// ---------- renderer, scene, camera ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (e) {
  showError("This browser can't show 3D here (WebGL is turned off or not supported).");
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
camera.position.set(0, 1.2, 4);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotateSpeed = 1.2;

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
const key = new THREE.DirectionalLight(0xffffff, 2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0xffffff, 0);
scene.add(hemi, key, key.target, rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.3 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- humanoid bone names ----------
// Canonical names (VRM's for the main bones; fingers as leftIndex1..3), parents first.
const MAIN = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'];
const SIDE_BONES = ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes'];
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const CANON = [...MAIN];
for (const s of ['left', 'right']) {
  for (const b of SIDE_BONES) CANON.push(s + b);
  for (const f of FINGERS) for (let n = 1; n <= 3; n++) CANON.push(s + f + n);
}
const CHILD = { hips: ['spine'], spine: ['chest', 'upperChest', 'neck'], chest: ['upperChest', 'neck'], upperChest: ['neck'], neck: ['head'] };
for (const s of ['left', 'right']) {
  Object.assign(CHILD, {
    [s + 'Shoulder']: [s + 'UpperArm'], [s + 'UpperArm']: [s + 'LowerArm'], [s + 'LowerArm']: [s + 'Hand'],
    [s + 'Hand']: [s + 'Middle1', s + 'Index1'], [s + 'UpperLeg']: [s + 'LowerLeg'], [s + 'LowerLeg']: [s + 'Foot'],
    [s + 'Foot']: [s + 'Toes'],
  });
  for (const f of FINGERS) { CHILD[s + f + 1] = [s + f + 2]; CHILD[s + f + 2] = [s + f + 3]; }
}
const VRM_FINGER = { Thumb: ['Metacarpal', 'Proximal', 'Distal'], other: ['Proximal', 'Intermediate', 'Distal'] };

function tokens(name) {
  const bare = String(name).replace(/^.*[:|]/, '');
  return bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/).map(t => t.toLowerCase()).filter(Boolean);
}

// The canonical name for one bone name, or null.
function canonical(name) {
  const tk = tokens(name);
  const has = t => tk.includes(t);
  const any = (...a) => a.some(has);
  if (tk.some(t => ['end', 'top', 'twist', 'pole', 'ctrl', 'target', 'nub', 'roll', 'helper', 'mch', 'org', 'ik', 'fk', 'socket'].includes(t))) return null;
  let side = null;
  if (any('left', 'l')) side = 'left';
  else if (any('right', 'r')) side = 'right';

  // fingers: "LeftHandIndex1", "index_01_l", "J_Bip_L_Index1", "f_index.01.L", VRM "...Proximal"
  for (let i = 0; i < tk.length; i++) {
    const m = tk[i].match(/^(?:f)?(thumb|index|middle|ring|pinky|little)(\d*)$/);
    if (!m || !side) continue;
    const finger = m[1] === 'pinky' ? 'Little' : m[1][0].toUpperCase() + m[1].slice(1);
    let n = m[2] ? parseInt(m[2], 10) : NaN;
    if (isNaN(n) && tk[i + 1] && /^\d+$/.test(tk[i + 1])) n = parseInt(tk[i + 1], 10);
    const stage = ['metacarpal', 'proximal', 'intermediate', 'distal'].find(has);
    if (stage) {
      const list = finger === 'Thumb' ? VRM_FINGER.Thumb : VRM_FINGER.other;
      const k = list.map(s => s.toLowerCase()).indexOf(stage);
      if (k >= 0) n = k + 1;
    }
    if (n >= 1 && n <= 3) return side + finger + n;
    return null;
  }
  if (!side) {
    if (any('hips', 'pelvis', 'hip')) return 'hips';
    for (let i = 0; i < tk.length; i++) {
      const m = tk[i].match(/^spine(\d*)$/);
      if (!m) continue;
      let digits = m[1] || (tk[i + 1] && /^\d+$/.test(tk[i + 1]) ? tk[i + 1] : '');
      if (digits.length >= 2) return ['spine', 'chest', 'upperChest'][parseInt(digits, 10) - 1] || null;
      return ['spine', 'chest', 'upperChest'][digits ? parseInt(digits, 10) : 0] || null;
    }
    if (has('chest')) return has('upper') ? 'upperChest' : 'chest';
    if (has('neck')) return 'neck';
    if (has('head')) return 'head';
    return null;
  }
  const S = side;
  if (any('shoulder', 'clavicle', 'collar')) return S + 'Shoulder';
  if (any('forearm', 'lowerarm', 'elbow') || (has('arm') && any('fore', 'lower'))) return S + 'LowerArm';
  if (has('upperarm') || has('arm')) return S + 'UpperArm';
  if (has('hand')) return S + 'Hand';
  if (any('upleg', 'thigh', 'upperleg') || (has('leg') && any('up', 'upper'))) return S + 'UpperLeg';
  if (any('calf', 'shin', 'lowerleg', 'knee') || has('leg')) return S + 'LowerLeg';
  if (any('toe', 'toes', 'toebase', 'ball')) return S + 'Toes';
  if (any('foot', 'ankle')) return S + 'Foot';
  return null;
}

// Canonical name -> bone for every humanoid bone found under root.
function mapBones(root) {
  const map = new Map();
  root.traverse(o => {
    if (!o.isBone) return;
    const c = canonical(o.name);
    if (c && !map.has(c)) map.set(c, o);
  });
  return map;
}

function mapVrmBones(vrm) {
  const map = new Map();
  for (const c of CANON) {
    let name = c;
    const m = c.match(/^(left|right)(Thumb|Index|Middle|Ring|Little)(\d)$/);
    if (m) name = m[1] + m[2] + (m[2] === 'Thumb' ? VRM_FINGER.Thumb : VRM_FINGER.other)[+m[3] - 1];
    const node = vrm.humanoid.getNormalizedBoneNode(name);
    if (node) map.set(c, node);
  }
  return map;
}

// ---------- rig: rest pose + helpers for posing in world space ----------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

class Rig {
  constructor(root, map) {
    this.root = root;
    this.map = map;
    this.order = CANON.filter(c => map.has(c));
    root.updateMatrixWorld(true);
    this.rest = new Map();
    for (const c of this.order) {
      const b = map.get(c);
      this.rest.set(c, {
        local: b.quaternion.clone(),
        pos: b.position.clone(),
        world: b.getWorldQuaternion(new THREE.Quaternion()),
        worldPos: b.getWorldPosition(new THREE.Vector3()),
        dir: this.dirOf(c)?.clone() || null,
      });
    }
    const hips = this.rest.get('hips');
    const feet = ['leftFoot', 'rightFoot', 'leftToes', 'rightToes'].filter(c => this.rest.has(c)).map(c => this.rest.get(c).worldPos.y);
    this.hipsHeight = hips ? hips.worldPos.y - (feet.length ? Math.min(...feet) : 0) : 1;
  }
  bone(c) { return this.map.get(c); }
  childOf(c) { return (CHILD[c] || []).find(k => this.map.has(k)); }
  dirOf(c) {
    const k = this.childOf(c);
    if (!k) return null;
    const a = this.map.get(c).getWorldPosition(new THREE.Vector3());
    const b = this.map.get(k).getWorldPosition(new THREE.Vector3());
    const d = b.sub(a);
    return d.lengthSq() > 1e-10 ? d.normalize() : null;
  }
  reset() {
    for (const c of this.order) {
      const r = this.rest.get(c), b = this.map.get(c);
      b.quaternion.copy(r.local);
      b.position.copy(r.pos);
    }
  }
  setWorld(c, qw) {
    const b = this.map.get(c);
    if (b.parent) b.parent.getWorldQuaternion(_q2); else _q2.identity();
    b.quaternion.copy(_q2.invert().multiply(qw));
  }
  // rotate bone c (world axis/angle), keeping everything below attached
  turn(c, axis, angle) {
    if (!this.map.has(c) || !angle) return;
    const b = this.map.get(c);
    b.getWorldQuaternion(_q);
    _q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
    this.setWorld(c, _q);
  }
  // point bone c along a world direction
  aim(c, dir) {
    if (!this.map.has(c)) return;
    const cur = this.dirOf(c);
    if (!cur) return;
    const b = this.map.get(c);
    b.getWorldQuaternion(_q);
    _q.premultiply(new THREE.Quaternion().setFromUnitVectors(cur, _v.copy(dir).normalize()));
    this.setWorld(c, _q);
  }
  // Point a two-bone limb (upper arm + forearm, or thigh + shin) along uDir and lDir while
  // keeping its hinge (elbow/knee axis) in place: the upper bone gets the whole rotation
  // that carries the current hinge onto the wanted one, then the lower bone just bends.
  // Aiming each bone by the shortest turn instead lets the limb twist about its own axis,
  // which wrings the skin and points elbows and knees the wrong way.
  // hinge: a fixed world axis (knees), or null to use the elbow's own bend plane.
  aimLimb(c1, c2, uDir, lDir, hinge) {
    if (!this.map.has(c1) || !this.map.has(c2)) { this.aim(c1, uDir); this.aim(c2, lDir); return; }
    const u0 = this.dirOf(c1), l0 = this.dirOf(c2);
    if (!u0 || !l0) { this.aim(c1, uDir); this.aim(c2, lDir); return; }
    const u = uDir.clone().normalize(), l = lDir.clone().normalize();
    let n0 = hinge ? hinge.clone() : new THREE.Vector3().crossVectors(u0, l0);
    if (n0.lengthSq() < 1e-4) { this.aim(c1, u); this.aim(c2, l); return; }
    n0.normalize();
    const carried = n0.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(u0, u));
    let n = hinge ? hinge.clone() : new THREE.Vector3().crossVectors(u, l);
    if (n.lengthSq() < 0.0025) n = carried;                  // nearly straight: keep the hinge
    else if (n.dot(carried) < 0) n.negate();                 // never flip the joint backwards
    const basis = (a, h) => {
      const x = a.clone();
      const z = h.clone().sub(x.clone().multiplyScalar(x.dot(h))).normalize();
      return new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z);
    };
    const R = new THREE.Quaternion().setFromRotationMatrix(basis(u, n).multiply(basis(u0, n0).transpose()));
    const b = this.map.get(c1);
    b.getWorldQuaternion(_q);
    _q.premultiply(R);
    this.setWorld(c1, _q);
    this.aim(c2, l);
  }
  // move the hips (world offset from their rest position)
  hipsOffset(off) {
    const r = this.rest.get('hips'), b = this.map.get('hips');
    if (!r || !b) return;
    const w = _v2.copy(r.worldPos).add(off);
    if (b.parent) b.parent.worldToLocal(w);
    b.position.copy(w);
  }
}

// ---------- built-in moves (made in code) ----------
// Directions are in the avatar's own space: +X its left, +Y up, +Z its front.
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const d = (x, y, z) => new THREE.Vector3(x, y, z);
const swingDir = (side, a, out = 0.06) => d(side * out, -Math.cos(a), Math.sin(a)); // a: forward angle from straight down

// One leg: thigh swung `a` radians forward (negative = behind), knee bent `flex`.
// The foot stays roughly square to the shin, so ankles don't lock.
function leg(p, s, a, flex, out = 0.05) {
  const n = s > 0 ? 'left' : 'right';
  const shin = a - flex;
  const f = shin + 1.32 + Math.min(0, shin) * 0.2;
  p.aim[n + 'UpperLeg'] = swingDir(s, a, out);
  p.aim[n + 'LowerLeg'] = swingDir(s, shin, out * 0.6);
  p.aim[n + 'Foot'] = d(s * 0.05, -Math.cos(f), Math.sin(f));
}
// One arm: upper arm swung `a` radians forward from hanging down, elbow bent `e`.
function arm(p, s, a, e, out = 0.15) {
  const n = s > 0 ? 'left' : 'right';
  p.aim[n + 'UpperArm'] = d(s * out, -Math.cos(a), Math.sin(a));
  p.aim[n + 'LowerArm'] = d(s * out * 0.6, -Math.cos(a + e), Math.sin(a + e));
}
function standLegs(p, bend = 0) { leg(p, 1, bend, bend * 2); leg(p, -1, bend, bend * 2); }
function relaxedArms(p, sway = 0) { arm(p, 1, 0.03 + sway, 0.15, 0.16); arm(p, -1, 0.03 + sway, 0.15, 0.16); }
const hump = (x, k = 1) => Math.pow(Math.max(0, x), k);

const CLIPS = {
  still: null,
  idle(t) {
    const p = { aim: {}, turn: [], hips: d(0, 0, 0) };
    const br = Math.sin(t * 1.7);
    standLegs(p);
    relaxedArms(p, br * 0.015);
    p.turn.push(['chest', X, -0.02 * br], ['head', Y, 0.08 * Math.sin(t * 0.45)], ['neck', X, 0.03 * Math.sin(t * 0.3)]);
    p.hips.y = -0.004 * (1 + br);
    return p;
  },
  // Gaits: each leg's phase φ (the right leg half a cycle behind). The thigh swings with
  // sin φ; the knee folds during the swing forward (when cos φ > 0) and stays nearly
  // straight while the foot is on the ground. Arms swing against the legs.
  walk(t) {
    const ph = (t / 1.1) * TAU;
    const p = { aim: {}, turn: [], hips: d(0, -0.018 + 0.014 * Math.cos(2 * ph), 0) };
    for (const s of [1, -1]) {
      const f = ph + (s > 0 ? 0 : Math.PI);
      leg(p, s, 0.04 + 0.36 * Math.sin(f), 0.06 + 0.75 * hump(Math.cos(f + 0.5), 1.6));
      arm(p, s, -0.28 * Math.sin(f), 0.25 + 0.15 * hump(-Math.sin(f)), 0.14);
    }
    const sw = Math.sin(ph);
    p.turn.push(['hips', Y, 0.08 * sw], ['spine', Y, -0.05 * sw], ['chest', Y, -0.04 * sw], ['spine', X, 0.03]);
    return p;
  },
  run(t) {
    const ph = (t / 0.66) * TAU;
    const p = { aim: {}, turn: [], hips: d(0, -0.04 + 0.035 * Math.cos(2 * ph), 0) };
    for (const s of [1, -1]) {
      const f = ph + (s > 0 ? 0 : Math.PI);
      leg(p, s, 0.15 + 0.55 * Math.sin(f), 0.3 + 1.5 * hump(Math.cos(f + 0.4), 1.3));
      arm(p, s, -0.1 - 0.5 * Math.sin(f), 1.35, 0.17);
    }
    const sw = Math.sin(ph);
    p.turn.push(['spine', X, 0.15], ['hips', Y, 0.1 * sw], ['chest', Y, -0.13 * sw], ['head', X, -0.12]);
    return p;
  },
  wave(t) {
    const p = CLIPS.idle(t);
    p.aim.rightUpperArm = d(-0.72, 0.55, 0.25);
    p.aim.rightLowerArm = d(-0.12 + 0.38 * Math.sin(t * 7), 1, 0.25);
    p.turn.push(['head', Z, 0.06], ['neck', Y, -0.08]);
    return p;
  },
  // A groove: knees bounce on every beat, hips sway every two, arms pump at chest height.
  dance(t) {
    const bt = (t / 0.6) * TAU, bounce = (1 - Math.cos(bt)) / 2, sway = Math.sin(bt / 2);
    const p = { aim: {}, turn: [], hips: d(0.035 * sway, -0.035 * bounce, 0) };
    for (const s of [1, -1]) {
      leg(p, s, 0.1 + 0.12 * bounce, 0.22 + 0.25 * bounce, 0.08);
      arm(p, s, 0.55 + 0.3 * Math.sin(bt + (s > 0 ? 0 : Math.PI)), 1.25, 0.28);
    }
    p.turn.push(['hips', Y, 0.22 * sway], ['chest', Z, -0.08 * sway], ['chest', Y, -0.1 * sway], ['head', X, 0.1 * Math.sin(bt)]);
    return p;
  },
  jump(t) {
    const ph = (t % 1.4) / 1.4;
    let crouch = 0, up = 0, arms = 0;
    if (ph < 0.25) { crouch = Math.sin(ph / 0.25 * Math.PI / 2); arms = -crouch; }
    else if (ph < 0.65) { const k = (ph - 0.25) / 0.4; up = Math.sin(k * Math.PI); arms = Math.min(1, k * 3); crouch = Math.max(0, 1 - k * 4); }
    else if (ph < 0.85) { const k = (ph - 0.65) / 0.2; crouch = Math.sin(k * Math.PI) * 0.8; arms = 1 - k; }
    const p = { aim: {}, turn: [['spine', X, 0.3 * crouch]], hips: d(0, -0.18 * crouch + 0.28 * up, 0) };
    for (const s of [1, -1]) {
      leg(p, s, 0.85 * crouch + 0.12 * up, 1.5 * crouch + 0.35 * up);
      arm(p, s, -0.45 + 2.5 * Math.max(0, arms), 0.3 + 0.25 * Math.max(0, arms), 0.22);
    }
    return p;
  },
  armsup(t) {
    const p = { aim: {}, turn: [['head', X, -0.12]], hips: d(0, 0, 0) };
    standLegs(p);
    const w = 0.04 * Math.sin(t * 3);
    p.aim.leftUpperArm = d(0.32 + w, 1, 0.08); p.aim.leftLowerArm = d(0.2 + w, 1, 0.08);
    p.aim.rightUpperArm = d(-0.32 - w, 1, 0.08); p.aim.rightLowerArm = d(-0.2 - w, 1, 0.08);
    return p;
  },
  tpose() {
    const p = { aim: {}, turn: [], hips: d(0, 0, 0) };
    standLegs(p);
    p.aim.leftUpperArm = d(1, 0, 0); p.aim.leftLowerArm = d(1, 0, 0); p.aim.leftHand = d(1, 0, 0);
    p.aim.rightUpperArm = d(-1, 0, 0); p.aim.rightLowerArm = d(-1, 0, 0); p.aim.rightHand = d(-1, 0, 0);
    return p;
  },
};

// Real shoulders lift the collarbone as the arm rises; without it the shoulder skin has
// to stretch the whole way and looks wrong. From about 20° below level, the collarbone
// rises by 30% of the arm's height angle, up to about 23°.
function shrug(p) {
  for (const [n, s] of [['left', 1], ['right', -1]]) {
    const dir = p.aim[n + 'UpperArm'];
    if (!dir) continue;
    const e = Math.asin(THREE.MathUtils.clamp(dir.clone().normalize().y, -1, 1));
    const k = THREE.MathUtils.clamp((e + 0.35) * 0.3, 0, 0.4);
    if (k > 0) p.turn.push([n + 'Shoulder', Z, s * k]);
  }
}

function applyPose(rig, p, facing) {
  rig.reset();
  if (!p) return;
  shrug(p);
  if (p.hips) rig.hipsOffset(p.hips.clone().applyQuaternion(facing));
  const turns = new Map();
  for (const [c, axis, a] of p.turn || []) { if (!turns.has(c)) turns.set(c, []); turns.get(c).push([axis, a]); }
  const LIMBS = { UpperArm: ['LowerArm', false], UpperLeg: ['LowerLeg', true] };
  const done = new Set();
  const kneeAxis = X.clone().applyQuaternion(facing);
  for (const c of rig.order) {
    for (const [axis, a] of turns.get(c) || []) rig.turn(c, axis.clone().applyQuaternion(facing), a);
    if (!p.aim || !p.aim[c] || done.has(c)) continue;
    const m = c.match(/^(left|right)(UpperArm|UpperLeg)$/);
    const lower = m && m[1] + LIMBS[m[2]][0];
    if (m && p.aim[lower]) {
      rig.aimLimb(c, lower, p.aim[c].clone().applyQuaternion(facing), p.aim[lower].clone().applyQuaternion(facing),
        LIMBS[m[2]][1] ? kneeAxis : null);
      done.add(lower);
    } else {
      rig.aim(c, p.aim[c].clone().applyQuaternion(facing));
    }
  }
}

// ---------- retargeting an animation file onto the avatar ----------
class Retarget {
  // source: { root, rig (rest captured when the file was read), mixer }
  constructor(source, clip, target) {
    this.src = source.rig;
    this.mixer = source.mixer;
    this.mixer.stopAllAction();
    this.action = this.mixer.clipAction(clip);
    this.action.reset().play();
    this.srcRoot = source.root;
    this.target = target;
    this.pairs = target.order.filter(c => this.src.map.has(c));
    this.align = new Map();
    for (const c of this.pairs) {
      const ts = target.rest.get(c).dir, ss = this.src.rest.get(c).dir;
      this.align.set(c, ts && ss ? new THREE.Quaternion().setFromUnitVectors(ts, ss) : new THREE.Quaternion());
    }
    this.scale = target.hipsHeight / Math.max(this.src.hipsHeight, 1e-6);
  }
  update(dt) {
    this.mixer.update(dt);
    this.srcRoot.updateMatrixWorld(true);
    const t = this.target;
    t.reset();
    const sq = new THREE.Quaternion(), delta = new THREE.Quaternion(), want = new THREE.Quaternion();
    for (const c of this.pairs) {
      this.src.bone(c).getWorldQuaternion(sq);
      delta.copy(sq).multiply(_q.copy(this.src.rest.get(c).world).invert());
      want.copy(delta).multiply(this.align.get(c)).multiply(t.rest.get(c).world);
      t.setWorld(c, want);
    }
    if (this.src.map.has('hips') && t.map.has('hips')) {
      const off = this.src.bone('hips').getWorldPosition(new THREE.Vector3()).sub(this.src.rest.get('hips').worldPos).multiplyScalar(this.scale);
      off.x = 0; off.z = 0; // in place: keep the avatar in view
      t.hipsOffset(off);
    }
  }
}

// ---------- face ----------
const ARKIT = ['browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight', 'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft',
  'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower',
  'mouthShrugUpper', 'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut'];
const PRESETS = {
  neutral: {},
  happy: { mouthSmileLeft: 1, mouthSmileRight: 1, cheekSquintLeft: 0.5, cheekSquintRight: 0.5, eyeSquintLeft: 0.3, eyeSquintRight: 0.3 },
  sad: { browInnerUp: 1, mouthFrownLeft: 0.8, mouthFrownRight: 0.8, mouthShrugLower: 0.4, eyeLookDownLeft: 0.3, eyeLookDownRight: 0.3 },
  angry: { browDownLeft: 1, browDownRight: 1, noseSneerLeft: 0.6, noseSneerRight: 0.6, mouthFrownLeft: 0.6, mouthFrownRight: 0.6, eyeSquintLeft: 0.4, eyeSquintRight: 0.4 },
  surprised: { browInnerUp: 1, browOuterUpLeft: 1, browOuterUpRight: 1, eyeWideLeft: 1, eyeWideRight: 1, jawOpen: 0.45 },
  aa: { jawOpen: 0.6, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3 },
  ee: { mouthStretchLeft: 0.6, mouthStretchRight: 0.6, jawOpen: 0.2, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },
  ih: { mouthStretchLeft: 0.35, mouthStretchRight: 0.35, jawOpen: 0.25 },
  oh: { mouthFunnel: 0.8, jawOpen: 0.35 },
  ou: { mouthPucker: 0.9, jawOpen: 0.12 },
};
const VISEME_FOR = { aa: 'viseme_aa', ee: 'viseme_E', ih: 'viseme_I', oh: 'viseme_O', ou: 'viseme_U' };

const face = {
  meshes: [],          // { mesh, dict }
  names: [],           // every face shape name on the model
  base: {},            // values from sliders / presets
  talk: false,
  vrmExpr: null,       // VRM expression manager (when the file is a VRM)
  vrmNames: new Set(),
};

function collectFace(root, vrm) {
  face.meshes = [];
  const names = new Set();
  root.traverse(o => {
    if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
      face.meshes.push({ mesh: o, dict: o.morphTargetDictionary });
      for (const n of Object.keys(o.morphTargetDictionary)) names.add(n);
    }
  });
  face.vrmExpr = vrm?.expressionManager || null;
  face.vrmNames = new Set(face.vrmExpr ? face.vrmExpr.expressions.map(e => e.expressionName) : []);
  face.names = [...names];
  face.base = {};
}
function hasShape(n) { return face.vrmNames.has(n) || face.names.includes(n); }
function presetValues(name) {
  if (VISEME_FOR[name] && hasShape(VISEME_FOR[name])) return { [VISEME_FOR[name]]: 1 };
  const arkit = PRESETS[name] || {};
  const usable = Object.fromEntries(Object.entries(arkit).filter(([k]) => hasShape(k)));
  if (Object.keys(usable).length) return usable;
  if (face.vrmNames.has(name)) return { [name]: 1 };   // VRM preset expressions (happy, aa, ...)
  return {};
}
// Apply a full set of values: every known shape is written (0 when missing).
function writeFace(values) {
  for (const { mesh, dict } of face.meshes) {
    const inf = mesh.morphTargetInfluences;
    for (const [n, i] of Object.entries(dict)) {
      if (face.vrmNames.has(n)) continue; // the VRM expression owns it
      inf[i] = values[n] || 0;
    }
  }
  if (face.vrmExpr) for (const n of face.vrmNames) face.vrmExpr.setValue(n, values[n] || 0);
}

// blinking
let nextBlink = 2, blinkT = -1;
function blinkValue(dt) {
  if (!$('al-blink').checked) return 0;
  nextBlink -= dt;
  if (nextBlink <= 0) { blinkT = 0; nextBlink = 2.5 + Math.random() * 3.5; }
  if (blinkT < 0) return 0;
  blinkT += dt;
  const v = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.16 ? 1 - (blinkT - 0.07) / 0.09 : 0;
  if (blinkT > 0.16) blinkT = -1;
  return Math.max(0, v);
}

// ---------- webcam face tracking ----------
const cam = { on: false, landmarker: null, stream: null, last: -1, values: {}, head: null, starting: false };
const video = $('al-video');

async function startCam() {
  if (cam.starting) return;
  cam.starting = true;
  const btn = $('al-cam');
  try {
    note('al-cam-note', 'Starting the camera…');
    if (!cam.landmarker) {
      const { FilesetResolver, FaceLandmarker } = await import('./vendor/mediapipe/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(new URL('vendor/mediapipe/wasm', location.href).href);
      const opts = delegate => ({
        baseOptions: { modelAssetPath: new URL('vendor/mediapipe/face_landmarker.task', location.href).href, delegate },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
      try { cam.landmarker = await FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch (e) { cam.landmarker = await FaceLandmarker.createFromOptions(files, opts('CPU')); }
    }
    cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    video.srcObject = cam.stream;
    await video.play();
    video.hidden = !$('al-preview').checked;
    cam.on = true;
    btn.textContent = 'Stop the camera';
    btn.setAttribute('aria-pressed', 'true');
    note('al-cam-note', 'Your camera picture is read in this browser tab only. It isn\'t recorded, saved or sent anywhere.');
  } catch (e) {
    console.error(e);
    stopCam();
    note('al-cam-note', e && e.name === 'NotAllowedError'
      ? 'The camera was blocked. Allow it for this page in the browser to use face tracking.'
      : 'The camera or face tracker couldn\'t start in this browser.');
  } finally {
    cam.starting = false;
  }
}
function stopCam() {
  cam.on = false;
  if (cam.stream) for (const tr of cam.stream.getTracks()) tr.stop();
  cam.stream = null;
  video.srcObject = null;
  video.hidden = true;
  cam.values = {};
  cam.head = null;
  const btn = $('al-cam');
  btn.textContent = 'Copy my face';
  btn.setAttribute('aria-pressed', 'false');
}
const swapLR = n => n.replace(/Left$/, '\u0000').replace(/Right$/, 'Left').replace('\u0000', 'Right');

function trackFrame() {
  if (!cam.on || !cam.landmarker || video.readyState < 2 || video.currentTime === cam.last) return;
  cam.last = video.currentTime;
  const res = cam.landmarker.detectForVideo(video, performance.now());
  const mirror = $('al-mirror').checked;
  const cats = res.faceBlendshapes?.[0]?.categories;
  if (!cats) return;
  const out = {};
  for (const c of cats) {
    if (c.categoryName.startsWith('_')) continue;
    const n = mirror ? swapLR(c.categoryName) : c.categoryName;
    const prev = cam.values[n] || 0;
    out[n] = prev + (c.score - prev) * 0.6;   // a little smoothing
  }
  cam.values = out;
  const m = res.facialTransformationMatrixes?.[0];
  if (m) {
    const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().fromArray(m.data), 'YXZ');
    const k = mirror ? -1 : 1;
    const want = new THREE.Euler(e.x, e.y * k, e.z * k, 'YXZ');
    cam.head = cam.head || new THREE.Euler(0, 0, 0, 'YXZ');
    cam.head.x += (want.x - cam.head.x) * 0.5;
    cam.head.y += (want.y - cam.head.y) * 0.5;
    cam.head.z += (want.z - cam.head.z) * 0.5;
  }
}
// VRM files without ARKit shapes: drive their standard expressions instead
function camForVrmPresets(v) {
  return {
    blinkLeft: v.eyeBlinkLeft || 0, blinkRight: v.eyeBlinkRight || 0,
    aa: v.jawOpen || 0, oh: v.mouthFunnel || 0, ou: v.mouthPucker || 0,
    happy: ((v.mouthSmileLeft || 0) + (v.mouthSmileRight || 0)) / 2,
    surprised: Math.max(0, (v.browInnerUp || 0) - 0.3),
  };
}

// ---------- the loaded avatar ----------
let avatar = null;   // { root, rig, vrm, mixer (own clips), facing, size, ... }
let clipName = 'still', clipTime = 0, fileClip = null, ownAction = null;
let skeletonHelper = null;
const fileClips = [];   // { label, srcRoot, clip }

function disposeAvatar() {
  if (!avatar) return;
  scene.remove(avatar.root);
  avatar.root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) {
      for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose();
      m.dispose();
    }
  });
  if (skeletonHelper) { scene.remove(skeletonHelper); skeletonHelper = null; }
  avatar = null;
  fileClips.length = 0;
  fileClip = null;
  renderFileClips();
}

// Animation files only lend their skeleton and motion: any texture they point at is
// swapped for a blank pixel instead of being fetched.
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const noTextures = new THREE.LoadingManager();
noTextures.setURLModifier(url => (/^(data|blob):/.test(url) ? url : BLANK));

const gltfLoader = new GLTFLoader();
gltfLoader.register(parser => new VRMLoaderPlugin(parser));

async function openFile(file) {
  hideError();
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['glb', 'gltf', 'vrm'].includes(ext)) {
    showError('Avatar Lab opens GLB and VRM files. For STL, PLY or USDZ, use the 3D Scan Viewer.');
    return;
  }
  setBusy(true, 'Reading the file…');
  await nextPaint();
  try {
    const buf = await file.arrayBuffer();
    const gltf = await gltfLoader.parseAsync(buf, '');
    const vrm = gltf.userData.vrm || null;
    let root = gltf.scene;
    if (vrm) {
      VRMUtils.removeUnnecessaryVertices(root);
      if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(root);
      if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
      root = vrm.scene;
    }
    let skinned = 0, tris = 0;
    const textures = new Set();
    root.traverse(o => {
      if (o.isSkinnedMesh) skinned++;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        const g = o.geometry;
        tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        for (const m of [].concat(o.material)) for (const k of Object.keys(m)) if (m[k] && m[k].isTexture && m[k].image) textures.add(m[k]);
      }
    });
    const map = vrm ? mapVrmBones(vrm) : mapBones(root);
    if (!skinned || !map.has('hips')) {
      showError(skinned ? 'This file has a skeleton, but no humanoid bones were recognised, so it can\'t do the moves.'
        : 'This file has no skeleton, so it can\'t move. Open it in the 3D Scan Viewer to look at it.');
      setBusy(false);
      return;
    }
    disposeAvatar();
    scene.add(root);
    root.updateMatrixWorld(true);
    if (vrm) vrm.update(0);
    const rig = new Rig(root, map);
    const facing = root.getWorldQuaternion(new THREE.Quaternion());
    collectFace(root, vrm);
    avatar = { root, rig, vrm, facing, file, gltf, ext, tris: Math.round(tris), textures, own: gltf.animations || [] };
    avatar.mixer = new THREE.AnimationMixer(root);
    for (const clip of avatar.own) fileClips.push({ label: clip.name || 'Animation', own: true, clip });
    renderFileClips();
    buildSliders();
    frame('body');
    setClip('idle');
    showFacts(file, buf.byteLength, vrm, map);
    panel.hidden = false;
    tools.hidden = false;
    $('al-hint').hidden = false;
    drop.classList.add('is-hidden');
    note('al-move-note', map.size < 12 ? 'Only some humanoid bones were recognised, so some moves may look partial.' : '');
  } catch (e) {
    console.error(e);
    showError('This file couldn\'t be read as a GLB or VRM avatar.');
  }
  setBusy(false);
}

async function addAnimationFiles(files) {
  if (!avatar) { showError('Open an avatar first, then add animations to it.'); return; }
  hideError();
  setBusy(true, 'Reading the animation…');
  await nextPaint();
  let added = 0;
  for (const file of files) {
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      const buf = await file.arrayBuffer();
      let srcRoot, clips;
      if (ext === 'fbx') {
        srcRoot = new FBXLoader(noTextures).parse(buf, '');
        clips = srcRoot.animations || [];
      } else {
        const g = await new GLTFLoader(noTextures).parseAsync(buf, '');
        srcRoot = g.scene;
        clips = g.animations || [];
      }
      const srcMap = mapBones(srcRoot);
      if (!srcMap.has('hips') || !clips.length) continue;
      const source = { root: srcRoot, rig: new Rig(srcRoot, srcMap), mixer: new THREE.AnimationMixer(srcRoot) };
      const base = file.name.replace(/\.[^.]+$/, '');
      for (const clip of clips) {
        const label = clips.length === 1 ? base : (clip.name || base).replace(/^.*\|/, '');
        fileClips.push({ label, source, clip });
        added++;
      }
    } catch (e) {
      console.error(e);
    }
  }
  setBusy(false);
  renderFileClips();
  if (!added) showError('No humanoid animation was found in that file.');
  else setClip('file:' + (fileClips.length - added));
}

function renderFileClips() {
  const box = $('al-file-clips');
  box.replaceChildren();
  fileClips.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.clip = 'file:' + i;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('translate', 'no');
    b.textContent = c.label;
    box.append(b);
  });
  box.hidden = !fileClips.length;
  syncClipButtons();
}

function setClip(name) {
  if (!avatar) return;
  clipName = name;
  clipTime = 0;
  fileClip = null;
  if (ownAction) { ownAction.stop(); ownAction = null; }
  if (name.startsWith('file:')) {
    const c = fileClips[+name.slice(5)];
    if (c.own) {
      avatar.rig.reset();
      ownAction = avatar.mixer.clipAction(c.clip);
      ownAction.reset().play();
    } else {
      fileClip = new Retarget(c.source, c.clip, avatar.rig);
    }
  }
  syncClipButtons();
}
function syncClipButtons() {
  for (const b of document.querySelectorAll('#al-clips button, #al-file-clips button')) {
    b.setAttribute('aria-pressed', String(b.dataset.clip === clipName));
  }
}

// ---------- face sliders ----------
function groupOf(n) {
  if (n.startsWith('viseme_')) return 'Mouth shapes for speech';
  if (/^eye/.test(n)) return 'Eyes';
  if (/^brow/.test(n)) return 'Brows';
  if (/^(jaw|tongue)/.test(n)) return 'Jaw and tongue';
  if (/^(mouth|cheek|nose)/.test(n)) return 'Mouth, cheeks and nose';
  return 'Other shapes';
}
function buildSliders() {
  const box = $('al-sliders');
  box.replaceChildren();
  const names = [...new Set([...face.names, ...face.vrmNames])];
  $('al-shape-count').textContent = names.length;
  const groups = new Map();
  for (const n of names.sort()) { const g = groupOf(n); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
  const order = ['Eyes', 'Brows', 'Mouth, cheeks and nose', 'Jaw and tongue', 'Mouth shapes for speech', 'Other shapes'];
  for (const g of order) {
    if (!groups.has(g)) continue;
    const h = document.createElement('h3');
    h.textContent = g;
    box.append(h);
    for (const n of groups.get(g)) {
      const row = document.createElement('label');
      row.className = 'al-slider';
      const span = document.createElement('span');
      span.textContent = n;
      span.title = n;
      span.setAttribute('translate', 'no');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = 0; input.max = 1; input.step = 0.01; input.value = 0;
      input.dataset.shape = n;
      input.addEventListener('input', () => { face.base[n] = +input.value; face.talk = false; });
      row.append(span, input);
      box.append(row);
    }
  }
  const none = !names.length;
  for (const id of ['al-presets', 'al-visemes']) $(id).hidden = none;
  note('al-face-note', none ? 'This avatar has no face shapes, so its face can\'t move. The body moves still work.' : '');
}
function syncSliders() {
  for (const input of document.querySelectorAll('#al-sliders input')) input.value = face.base[input.dataset.shape] || 0;
}

// ---------- facts ----------
function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
function showFacts(file, bytes, vrm, map) {
  const dl = $('al-facts');
  dl.replaceChildren();
  const row = (label, value) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.setAttribute('translate', 'no'); dd.textContent = value;
    dl.append(dt, dd);
  };
  row('File', file.name);
  row('File size', fmtBytes(bytes));
  row('Format', vrm ? 'VRM ' + (vrm.meta?.metaVersion === '0' ? '0.x' : '1.0') : 'glTF (' + avatar.ext.toUpperCase() + ')');
  if (vrm?.meta) {
    const m = vrm.meta;
    if (m.name || m.title) row('Name', m.name || m.title);
    const authors = m.authors || (m.author ? [m.author] : []);
    if (authors.length) row('Made by', authors.join(', '));
    const lic = [m.avatarPermission || m.allowedUserName, m.commercialUsage || m.commercialUssageName,
      m.allowRedistribution === false ? 'no redistribution' : m.allowRedistribution ? 'redistribution allowed' : null].filter(Boolean);
    if (lic.length) row('Licence', lic.join(' · '));
  }
  let bones = 0;
  avatar.root.traverse(o => { if (o.isBone) bones++; });
  row('Bones', String(bones));
  const main = ['hips', 'spine', 'chest', 'neck', 'head', 'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm',
    'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
  row('Humanoid bones found', main.filter(c => map.has(c)).length + ' / ' + main.length);
  row('Finger bones', String([...map.keys()].filter(c => /(Thumb|Index|Middle|Ring|Little)\d$/.test(c)).length));
  const names = new Set([...face.names, ...face.vrmNames]);
  row('Face shapes', String(names.size));
  row('ARKit face shapes', ARKIT.filter(n => names.has(n)).length + ' / 52');
  row('Speech mouth shapes', String([...names].filter(n => /^viseme_/.test(n)).length));
  row('Triangles', avatar.tris.toLocaleString());
  const sizes = [...avatar.textures].map(t => Math.max(t.image.width || 0, t.image.height || 0));
  row('Textures', avatar.textures.size + (sizes.length ? ' (largest ' + Math.max(...sizes) + ' px)' : ''));
  if (avatar.own.length) row('Animations in the file', String(avatar.own.length));
}

// ---------- view ----------
function frame(what) {
  if (!avatar) return;
  const box = new THREE.Box3().setFromObject(avatar.root);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const h = Math.max(size.y, 0.3);
  floor.position.y = box.min.y;
  floor.scale.setScalar(h * 4);
  key.position.set(centre.x + h * 1.2, box.min.y + h * 2, centre.z + h * 1.6);
  key.target.position.copy(centre);
  const s = key.shadow.camera; s.left = s.bottom = -h; s.right = s.top = h; s.near = 0.1; s.far = h * 6; s.updateProjectionMatrix();
  rim.position.set(centre.x - h, centre.y + h, centre.z - h * 1.5);
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(avatar.facing);
  if (what === 'face' && avatar.rig.map.has('head')) {
    const head = avatar.rig.bone('head').getWorldPosition(new THREE.Vector3());
    const target = head.clone().add(new THREE.Vector3(0, h * 0.04, 0));
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(front, h * 0.42).add(new THREE.Vector3(0, h * 0.01, 0));
  } else {
    const dist = (h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(front, dist).add(new THREE.Vector3(h * 0.25, h * 0.08, 0));
  }
  camera.near = h / 200; camera.far = h * 60; camera.updateProjectionMatrix();
  controls.update();
}

const LIGHTS = {
  studio: { env: 1, hemi: 0.4, key: 2, keyColor: 0xffffff, rim: 0.6 },
  daylight: { env: 0.8, hemi: 1.1, key: 2.8, keyColor: 0xfff1dc, rim: 0 },
  dramatic: { env: 0.15, hemi: 0.05, key: 3.2, keyColor: 0xffe2c4, rim: 2.2 },
};
function setLight(name) {
  const L = LIGHTS[name];
  scene.environmentIntensity = L.env;
  hemi.intensity = L.hemi;
  key.intensity = L.key;
  key.color.setHex(L.keyColor);
  rim.intensity = L.rim;
  stage.dataset.light = name;
  for (const b of document.querySelectorAll('[data-light]')) b.setAttribute('aria-pressed', String(b.dataset.light === name));
}
setLight('studio');

// ---------- loop ----------
const timer = new THREE.Timer();
let talkT = 0;
function tick(now) {
  requestAnimationFrame(tick);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  if (avatar) {
    const speed = +$('al-speed').value;
    clipTime += dt * speed;
    if (ownAction) avatar.mixer.update(dt * speed);
    else if (fileClip) fileClip.update(dt * speed);
    else applyPose(avatar.rig, CLIPS[clipName] ? CLIPS[clipName](clipTime) : null, avatar.facing);

    // face: sliders/presets, then talking, blinking and the webcam on top
    trackFrame();
    let values = { ...face.base };
    if (face.talk) {
      talkT += dt;
      const seq = ['aa', 'ih', 'ou', 'ee', 'oh', 'aa', 'neutral'];
      const k = talkT * 7, i = Math.floor(k) % seq.length, f = k % 1;
      const a = presetValues(seq[i]), b = presetValues(seq[(i + 1) % seq.length]);
      for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) values[n] = (a[n] || 0) * (1 - f) + (b[n] || 0) * f;
    }
    if (cam.on) {
      values = hasShape('eyeBlinkLeft') ? { ...cam.values } : camForVrmPresets(cam.values);
    } else {
      const bl = blinkValue(dt);
      if (bl) for (const n of hasShape('eyeBlinkLeft') ? ['eyeBlinkLeft', 'eyeBlinkRight'] : ['blink']) values[n] = Math.max(values[n] || 0, bl);
    }
    writeFace(values);
    if (cam.on && cam.head && avatar.rig.map.has('head')) {
      const e = cam.head, r = avatar.rig;
      const fq = avatar.facing;
      const turnHead = (c, f) => {
        r.turn(c, Y.clone().applyQuaternion(fq), THREE.MathUtils.clamp(e.y, -1, 1) * f);
        r.turn(c, X.clone().applyQuaternion(fq), THREE.MathUtils.clamp(-e.x, -0.8, 0.8) * f);
        r.turn(c, Z.clone().applyQuaternion(fq), THREE.MathUtils.clamp(e.z, -0.6, 0.6) * f);
      };
      if (r.map.has('neck')) turnHead('neck', 0.4);
      turnHead('head', r.map.has('neck') ? 0.6 : 1);
    }
    if (avatar.vrm) avatar.vrm.update(dt);
  }
  controls.autoRotate = $('al-spin').checked;
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

// ---------- inputs ----------
const fileInput = $('al-file');
fileInput.addEventListener('change', () => { if (fileInput.files[0]) openFile(fileInput.files[0]); fileInput.value = ''; });
$('al-anim-file').addEventListener('change', e => { if (e.target.files.length) addAnimationFiles([...e.target.files]); e.target.value = ''; });
for (const ev of ['dragenter', 'dragover']) stage.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); });
for (const ev of ['dragleave', 'drop']) stage.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); });
stage.addEventListener('drop', e => {
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) return;
  const isAnim = f => /\.fbx$/i.test(f.name);
  if (avatar && files.every(isAnim)) addAnimationFiles(files);
  else openFile(files.find(f => !isAnim(f)) || files[0]);
});
$('al-clips').addEventListener('click', e => { const b = e.target.closest('button[data-clip]'); if (b) setClip(b.dataset.clip); });
$('al-file-clips').addEventListener('click', e => { const b = e.target.closest('button[data-clip]'); if (b) setClip(b.dataset.clip); });
for (const id of ['al-presets', 'al-visemes']) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button[data-preset]');
    if (!b) return;
    if (b.dataset.preset === 'talk') { face.talk = !face.talk; talkT = 0; face.base = {}; }
    else { face.talk = false; face.base = presetValues(b.dataset.preset); }
    syncSliders();
  });
}
for (const b of document.querySelectorAll('[data-light]')) b.addEventListener('click', () => setLight(b.dataset.light));
$('al-shadow').addEventListener('change', e => { floor.visible = e.target.checked; });
$('al-bones').addEventListener('change', e => {
  if (skeletonHelper) { scene.remove(skeletonHelper); skeletonHelper = null; }
  if (e.target.checked && avatar) { skeletonHelper = new THREE.SkeletonHelper(avatar.root); scene.add(skeletonHelper); }
});
$('al-cam').addEventListener('click', () => (cam.on ? stopCam() : startCam()));
$('al-preview').addEventListener('change', e => { if (cam.on) video.hidden = !e.target.checked; });
$('al-mirror').addEventListener('change', e => video.classList.toggle('is-mirrored', e.target.checked));
video.classList.add('is-mirrored');
$('al-body').addEventListener('click', () => frame('body'));
$('al-face').addEventListener('click', () => frame('face'));
$('al-open').addEventListener('click', () => fileInput.click());
$('al-full').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen?.();
});
$('al-shot').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (avatar?.file.name.replace(/\.[^.]+$/, '') || 'avatar') + '-avatar-lab.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
});
window.addEventListener('pagehide', stopCam);

// for tests: a tiny hook so a script can check what loaded (no effect on the page)
window.__avatarLab = {
  get state() { return avatar ? { bones: avatar.rig.order.length, shapes: face.names.length + face.vrmNames.size, clip: clipName } : null; },
  get retarget() { return fileClip ? { pairs: fileClip.pairs.length, time: fileClip.action.time } : null; },
  // checks: joint positions (cm, avatar space: x = its left, y up, z its front, from the hips)
  joints(names) {
    if (!avatar) return null;
    const r = avatar.rig, hips = r.bone('hips').getWorldPosition(new THREE.Vector3());
    const inv = avatar.facing.clone().invert(), out = {};
    for (const c of names) if (r.map.has(c)) {
      const v = r.bone(c).getWorldPosition(new THREE.Vector3()).sub(hips).applyQuaternion(inv);
      out[c] = v.toArray().map(x => Math.round(x * 100));
    }
    return out;
  },
  // checks: hold a move at time t (seconds) and look from an angle (degrees around the avatar)
  hold(clip, t, angle = 0) {
    if (!avatar) return false;
    setClip(clip);
    clipTime = t;
    $('al-speed').value = 0;
    frame('body');
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(angle));
    camera.position.copy(controls.target).add(off);
    controls.update();
    return true;
  },
};
