// 3D Scan Viewer (stl-viewer.html). Opens an STL (or a GLB / PLY / USDZ scan) that the
// visitor picks or drops, entirely in the browser: the file is never uploaded.
//
// STL is read by our own parser (not three.js's STLLoader) so we can use
// everything an STL can hold: the 80-byte header text, the stored normals, and
// per-triangle colour in both conventions found in the wild:
//   - Materialise Magics: header has "COLOR=" + a default RGBA (and optionally
//     "MATERIAL=" with diffuse/specular/ambient). Per triangle, bit 15 = 0 means
//     "use this triangle's colour", stored R (bits 0-4), G (5-9), B (10-14).
//   - VisCAM / SolidView: bit 15 = 1 means "this triangle has a colour", stored
//     B (bits 0-4), G (5-9), R (10-14).
// Most STLs (scanner exports included) have no colour at all; the page says so
// and points at GLB/PLY/USDZ, which carry colour.
//
// three.js is vendored in vendor/three/ (0.186.1, from games/apex-dash-3d-masters)
// so the page loads nothing from other sites.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';

const $ = id => document.getElementById(id);
$('year').textContent = new Date().getFullYear();

const stage = $('sv-stage');
const canvas = $('sv-canvas');
const drop = $('sv-drop');
const fileInput = $('sv-file');
const panel = $('sv-panel');
const tools = $('sv-tools');

const state = { colour: 'file', light: 'studio', finish: 'satin', shade: 'smooth', up: 'y', unit: 'mm' };
let model = null;           // what's loaded now (see show())
let framed = null;          // camera position/target to go back to on "Reset view"

// ---------- errors / busy ----------
function showError(text) {
  const el = $('sv-error');
  el.textContent = text;
  el.hidden = false;
}
function hideError() { $('sv-error').hidden = true; }
function setBusy(on) { $('sv-busy').hidden = !on; }
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

// ---------- renderer, scene, camera ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  showError("This browser can't show 3D here (WebGL is turned off or not supported).");
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r18x

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(2, 1.5, 3);
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
scene.add(hemi, key, key.target, rim, rim.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.35 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const holder = new THREE.Group();   // turned for "Z is up", moved so the model stands on the floor
scene.add(holder);

// ---------- looks ----------
// Light directions are multiplied by the model's size, so any units work.
const LIGHTS = {
  studio:   { env: 0.8,  hemi: [0xffffff, 0x3a3a40, 0.35], key: [0xfff3e6, 2.2, [1, 1.6, 1.2]],   rim: [0xbcd0ff, 1.0, [-1.2, 1, -1.4]], shadow: 0.35 },
  even:     { env: 1.3,  hemi: [0xffffff, 0x8a8a8a, 0.6],  key: [0xffffff, 0.35, [0, 2, 1]],     rim: [0xffffff, 0, [0, 1, -1]],      shadow: 0.15 },
  daylight: { env: 0.6,  hemi: [0xcfe3ff, 0x6b5a45, 0.8],  key: [0xfff6e0, 3.0, [1.5, 2.5, 0.6]], rim: [0xffffff, 0, [0, 1, -1]],      shadow: 0.45 },
  dramatic: { env: 0.12, hemi: [0x223355, 0x000000, 0.15], key: [0xffe0c0, 4.0, [2, 0.8, 0.3]],   rim: [0x6fa0ff, 2.5, [-1.5, 1.2, -1.5]], shadow: 0.6 },
};
const FINISH = {
  matte:  { roughness: 0.9,  metalness: 0, clearcoat: 0 },
  satin:  { roughness: 0.55, metalness: 0, clearcoat: 0 },
  glossy: { roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1 },
  metal:  { roughness: 0.3,  metalness: 1, clearcoat: 0 },
};

let radius = 1;   // half the model's diagonal, in the file's units

function applyLights() {
  const L = LIGHTS[state.light];
  scene.environmentIntensity = L.env;
  hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
  const target = controls.target;
  for (const [light, spec] of [[key, L.key], [rim, L.rim]]) {
    light.color.set(spec[0]);
    light.intensity = spec[1];
    light.target.position.copy(target);
    light.position.set(spec[2][0], spec[2][1], spec[2][2]).normalize().multiplyScalar(radius * 4).add(target);
  }
  ground.material.opacity = L.shadow;
  stage.dataset.light = state.light;
}

// ---------- STL ----------
const latin1 = bytes => Array.from(bytes, b => String.fromCharCode(b)).join('');
const tmp = new THREE.Color();
const SCANNER_WORDS = /scaniverse|polycam|3d ?scanner|kiri|luma|lidar|iphone|ipad|scandy|trnio|qlone|reality ?scan/i;

function parseSTL(buf) {
  const len = buf.byteLength;
  const bytes = new Uint8Array(buf);
  const start = latin1(bytes.subarray(0, Math.min(len, 1024)));
  const dv = new DataView(buf);
  const n = len >= 84 ? dv.getUint32(80, true) : 0;
  const exact = len >= 84 && 84 + 50 * n === len;
  const looksText = /^\s*solid/i.test(start) && /facet/i.test(start);
  if (exact || (!looksText && n > 0 && 84 + 50 * n <= len)) return parseBinarySTL(buf, n);
  if (looksText || /^\s*solid/i.test(start)) return parseTextSTL(buf);
  throw new Error('Not an STL file');
}

function parseBinarySTL(buf, n) {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const headerRaw = latin1(bytes.subarray(0, 80));
  const header = headerRaw.replace(/[\x00-\x1f\x7f-\xff]+/g, ' ').trim();

  // Materialise: "COLOR=" then RGBA bytes; "MATERIAL=" then diffuse, specular, ambient RGBA.
  const ci = headerRaw.indexOf('COLOR=');
  const materialise = ci >= 0 && ci + 10 <= 80;
  const defColour = materialise ? [bytes[ci + 6] / 255, bytes[ci + 7] / 255, bytes[ci + 8] / 255] : [0.8, 0.8, 0.8];
  const mi = headerRaw.indexOf('MATERIAL=');
  let material = null;
  if (mi >= 0 && mi + 21 <= 80) {
    const rgb = o => [bytes[o], bytes[o + 1], bytes[o + 2]];
    material = { diffuse: rgb(mi + 9), specular: rgb(mi + 13), ambient: rgb(mi + 17) };
  }

  let bit15 = 0, nonZero = 0;
  for (let i = 0; i < n; i++) {
    const a = dv.getUint16(84 + 50 * i + 48, true);
    if (a) nonZero++;
    if (a & 0x8000) bit15++;
  }
  const colourKind = materialise ? 'materialise' : (bit15 > 0 ? 'viscam' : null);

  const pos = new Float32Array(n * 9);
  const col = colourKind ? new Float32Array(n * 9) : null;
  const distinct = new Set();
  let storedNormals = 0;
  for (let i = 0; i < n; i++) {
    const o = 84 + 50 * i;
    if (dv.getFloat32(o, true) || dv.getFloat32(o + 4, true) || dv.getFloat32(o + 8, true)) storedNormals++;
    for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + 12 + k * 4, true);
    if (!col) continue;
    const a = dv.getUint16(o + 48, true);
    let r, g, b;
    if (colourKind === 'materialise') {
      if (!(a & 0x8000)) { r = (a & 31) / 31; g = ((a >> 5) & 31) / 31; b = ((a >> 10) & 31) / 31; distinct.add(a); }
      else [r, g, b] = defColour;
    } else if (a & 0x8000) {
      b = (a & 31) / 31; g = ((a >> 5) & 31) / 31; r = ((a >> 10) & 31) / 31; distinct.add(a);
    } else [r, g, b] = [0.8, 0.8, 0.8];
    tmp.setRGB(r, g, b, THREE.SRGBColorSpace);
    for (let v = 0; v < 3; v++) { col[i * 9 + v * 3] = tmp.r; col[i * 9 + v * 3 + 1] = tmp.g; col[i * 9 + v * 3 + 2] = tmp.b; }
  }
  return {
    format: 'binary', header, triangles: n, pos, col, colourKind, distinctColours: distinct.size,
    storedNormals, material, unknownAttr: !colourKind && nonZero > 0,
  };
}

function parseTextSTL(buf) {
  const text = new TextDecoder().decode(buf);
  const name = (text.match(/^\s*solid[ \t]*([^\r\n]*)/i) || [, ''])[1].trim();
  const solids = (text.match(/^\s*solid\b/gim) || []).length;
  const verts = [];
  let storedNormals = 0, triangles = 0;
  const re = /facet\s+normal\s+(\S+)\s+(\S+)\s+(\S+)|vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      triangles++;
      if (+m[1] || +m[2] || +m[3]) storedNormals++;
    } else verts.push(+m[4], +m[5], +m[6]);
  }
  if (!verts.length || verts.length % 9) throw new Error('Text STL with no complete triangles');
  return {
    format: 'text', header: name, solids, triangles: verts.length / 9, pos: new Float32Array(verts),
    col: null, colourKind: null, distinctColours: 0, storedNormals, material: null, unknownAttr: false,
  };
}

// Area, volume and whether the surface is closed (every edge shared by exactly two triangles).
function meshStats(geometry) {
  const p = geometry.getAttribute('position').array;
  const idx = geometry.index ? geometry.index.array : null;
  const count = idx ? idx.length : p.length / 3;
  const nv = p.length / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let area = 0, volume = 0;
  const edges = idx ? new Map() : null;
  const addEdge = (i, j) => { const k = i < j ? i * nv + j : j * nv + i; edges.set(k, (edges.get(k) || 0) + 1); };
  for (let t = 0; t + 2 < count; t += 3) {
    const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2;
    a.fromArray(p, i0 * 3); b.fromArray(p, i1 * 3); c.fromArray(p, i2 * 3);
    ab.subVectors(b, a); ac.subVectors(c, a);
    area += ab.clone().cross(ac).length() / 2;
    volume += a.dot(b.clone().cross(c)) / 6;
    if (edges) { addEdge(i0, i1); addEdge(i1, i2); addEdge(i2, i0); }
  }
  let openEdges = null;
  if (edges) { openEdges = 0; for (const v of edges.values()) if (v !== 2) openEdges++; }
  return { area, volume: Math.abs(volume), openEdges, vertices: nv };
}

function loadSTL(buf, name) {
  const s = parseSTL(buf);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.computeBoundingBox();
  const tol = Math.max(g.boundingBox.getSize(new THREE.Vector3()).length() * 1e-6, 1e-9);

  // Shape-only weld for the numbers (so colour borders don't count as holes) ...
  const shape = mergeVertices(g, tol);
  const stats = meshStats(shape);
  // ... and a colour-aware weld for drawing, so smooth shading works across the mesh.
  if (s.col) {
    g.setAttribute('color', new THREE.BufferAttribute(s.col, 3));
    g = mergeVertices(g, tol);
    shape.dispose();
  } else g = shape;
  // Smooth across gentle bends (scans), but keep real corners sharp (CAD parts).
  const welded = g;
  g = toCreasedNormals(welded, THREE.MathUtils.degToRad(35));
  welded.dispose();

  return {
    kind: 'stl', object: new THREE.Mesh(g), hasColour: !!s.col, vertexColours: !!s.col, points: false,
    up: SCANNER_WORDS.test(s.header) ? 'y' : 'z', unit: null, stl: s, stats, name,
  };
}

// ---------- PLY ----------
function plyHeader(buf) {
  const head = latin1(new Uint8Array(buf, 0, Math.min(buf.byteLength, 4096)));
  const end = head.indexOf('end_header');
  const lines = (end >= 0 ? head.slice(0, end) : head).split(/\r?\n/);
  const format = (lines.find(l => l.startsWith('format ')) || '').split(/\s+/)[1] || '';
  const comments = lines.filter(l => /^(comment|obj_info) /.test(l)).map(l => l.replace(/^\S+\s+/, ''));
  const elements = lines.filter(l => l.startsWith('element ')).map(l => l.split(/\s+/).slice(1));
  const props = lines.filter(l => l.startsWith('property ')).map(l => l.split(/\s+/).pop());
  return { format, comments, elements, props };
}

function loadPLY(buf, name) {
  const info = plyHeader(buf);
  const loader = new PLYLoader();
  // Gaussian-splat PLYs (Scaniverse's "splat" export) keep colour as f_dc_0..2.
  if (info.props.includes('f_dc_0')) loader.setCustomPropertyNameMapping({ fdc: ['f_dc_0', 'f_dc_1', 'f_dc_2'] });
  const g = loader.parse(buf);
  let splat = false;
  if (!g.getAttribute('color') && g.getAttribute('fdc')) {
    const f = g.getAttribute('fdc').array;
    const col = new Float32Array(f.length);
    for (let i = 0; i < f.length; i += 3) {
      const cl = k => Math.min(1, Math.max(0, 0.5 + 0.28209479 * f[i + k]));
      tmp.setRGB(cl(0), cl(1), cl(2), THREE.SRGBColorSpace);
      col[i] = tmp.r; col[i + 1] = tmp.g; col[i + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    splat = true;
  }
  if (g.getAttribute('fdc')) g.deleteAttribute('fdc');
  const points = !g.index;
  const storedNormals = !!g.getAttribute('normal');
  if (!points && !storedNormals) g.computeVertexNormals();
  const hasColour = !!g.getAttribute('color');
  return {
    kind: 'ply', object: points ? new THREE.Points(g) : new THREE.Mesh(g), hasColour, vertexColours: hasColour,
    points, up: 'y', unit: null, ply: { ...info, storedNormals, splat },
    stats: points ? { vertices: g.getAttribute('position').count } : meshStats(g), name,
  };
}

// ---------- GLB and USDZ (whole scenes with their own materials) ----------
function sceneInfo(root) {
  let triangles = 0, meshes = 0, textured = false, vcol = false, tinted = false;
  const materials = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    o.castShadow = true;
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    if (g.getAttribute('color')) vcol = true;
    for (const m of [].concat(o.material)) {
      materials.add(m);
      if (m.map) textured = true;
      if (m.color && m.color.getHex() !== 0xffffff) tinted = true;
    }
    o.userData.fileMaterial = o.material;   // kept to switch back to "From the file"
  });
  return { triangles: Math.round(triangles), meshes, materials: materials.size, textured, vcol, tinted };
}

async function loadGLB(buf, name) {
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  const info = sceneInfo(gltf.scene);
  const asset = (gltf.parser && gltf.parser.json && gltf.parser.json.asset) || {};
  return {
    kind: 'glb', scene: true, object: gltf.scene, hasColour: info.textured || info.vcol || info.tinted, vertexColours: info.vcol,
    points: false, up: 'y', unit: 'm', info: { ...info, format: 'GLB (glTF, binary)', generator: asset.generator || '' }, name,
  };
}

// USDZ is Apple's format (iPhone scanning apps export it): a zip holding a USD
// scene and its texture images. three.js's USDLoader reads text and binary USD.
function loadUSDZ(buf, name) {
  return new Promise((resolve, reject) => {
    new USDLoader().parse(buf, '', group => {
      try {
        const info = sceneInfo(group);
        resolve({
          kind: 'usdz', scene: true, object: group, hasColour: info.textured || info.vcol || info.tinted, vertexColours: info.vcol,
          points: false, up: 'y', unit: 'm', info: { ...info, format: 'USDZ (Apple)', generator: '' }, name,
        });
      } catch (e) { reject(e); }
    }, reject);
  });
}

// ---------- materials ----------
let ownMaterials = [];
function disposeOwnMaterials() { ownMaterials.forEach(m => m.dispose()); ownMaterials = []; }

function applyMaterials() {
  if (!model) return;
  disposeOwnMaterials();
  const fromFile = state.colour === 'file' && model.hasColour;
  const single = new THREE.Color($('sv-colour').value);
  const flat = state.shade === 'flat', wire = state.shade === 'wire';

  if (model.points) {
    const m = new THREE.PointsMaterial({
      size: radius * 0.006, sizeAttenuation: true,
      vertexColors: fromFile, color: fromFile ? 0xffffff : single,
    });
    ownMaterials.push(m);
    model.object.material = m;
    return;
  }

  if (model.scene && fromFile) {
    model.object.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.userData.fileMaterial;
      for (const m of [].concat(o.material)) { m.wireframe = wire; m.flatShading = flat; m.needsUpdate = true; }
    });
    return;
  }

  const m = new THREE.MeshPhysicalMaterial({
    color: fromFile ? 0xffffff : single,
    vertexColors: fromFile && model.vertexColours,
    side: THREE.DoubleSide,   // scans are usually open, so the inside can show
    flatShading: flat, wireframe: wire,
    ...FINISH[state.finish],
  });
  ownMaterials.push(m);
  model.object.traverse(o => { if (o.isMesh) { o.material = m; o.castShadow = true; } });
}

// ---------- placing the model and the camera ----------
function place() {
  holder.rotation.set(state.up === 'z' ? -Math.PI / 2 : 0, 0, 0);
  holder.position.set(0, 0, 0);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box.min.y, -c.z);
  holder.updateMatrixWorld(true);
  const size = box.getSize(new THREE.Vector3());
  radius = Math.max(size.length() / 2, 1e-6);
  model.size = size;

  ground.scale.set(radius * 10, radius * 10, 1);
  ground.position.y = 0;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -radius * 1.3;
  sc.right = sc.top = radius * 1.3;
  sc.near = radius * 0.1;
  sc.far = radius * 10;
  sc.updateProjectionMatrix();

  const target = new THREE.Vector3(0, size.y / 2, 0);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  const position = new THREE.Vector3(0.55, 0.3, 1).normalize().multiplyScalar(dist).add(target);
  framed = { target, position };
  camera.near = dist / 1000;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();
  controls.minDistance = radius * 0.05;
  controls.maxDistance = radius * 30;
  resetView();
}

function resetView() {
  if (!framed) return;
  controls.target.copy(framed.target);
  camera.position.copy(framed.position);
  controls.update();
  applyLights();
}

// ---------- the "What's in the file" list ----------
const UNIT_M = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 };
const fmtLen = m => m < 0.01 ? `${(m * 1000).toFixed(1)} mm` : m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;
function fmtDims(v, f) {
  const big = Math.max(v.x, v.y, v.z) * f;
  const [k, u] = big < 0.01 ? [1000, 'mm'] : big < 1 ? [100, 'cm'] : [1, 'm'];
  const d = x => (x * f * k).toFixed(k === 1 ? 2 : 1);
  return `${d(v.x)} × ${d(v.z)} × ${d(v.y)} ${u}`;
}
const fmtArea = a => a < 1 ? `${(a * 1e4).toFixed(1)} cm²` : `${a.toFixed(2)} m²`;
const fmtVol = v => v < 0.001 ? `${(v * 1e6).toFixed(1)} cm³` : `${(v * 1000).toFixed(2)} L`;
const fmtNum = n => Math.round(n).toLocaleString('en-AU');
const fmtBytes = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const hex = rgb => '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');

// A value is a list of pieces: plain strings get translated, {data} pieces don't.
function renderFacts() {
  const dl = $('sv-facts');
  dl.replaceChildren();
  const add = (label, ...pieces) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    for (const p of pieces) {
      if (p instanceof Node) dd.append(p);
      else if (typeof p === 'object') { const s = document.createElement('span'); s.translate = false; s.setAttribute('translate', 'no'); s.textContent = p.data; dd.append(s); }
      else { const s = document.createElement('span'); s.textContent = p; dd.append(s); }
    }
    dl.append(dt, dd);
  };
  const m = model;
  const f = UNIT_M[state.unit];

  add('File', { data: m.name });
  add('File size', { data: fmtBytes(m.bytes) });

  if (m.kind === 'stl') {
    const s = m.stl;
    add('Format', s.format === 'binary' ? 'STL, binary' : 'STL, text');
    if (s.header) add(s.format === 'binary' ? 'Header' : 'Name', { data: s.header });
    if (s.solids > 1) add('Parts', { data: fmtNum(s.solids) });
    add('Triangles', { data: fmtNum(s.triangles) });
    add('Corners (shared)', { data: fmtNum(m.stats.vertices) });
  } else if (m.kind === 'ply') {
    const p = m.ply;
    add('Format', p.format.startsWith('binary') ? 'PLY, binary' : 'PLY, text');
    for (const c of p.comments.slice(0, 3)) add('Note in file', { data: c });
    for (const [el, count] of p.elements) add('Element', { data: `${el}: ${fmtNum(+count)}` });
  } else {
    const g = m.info;
    add('Format', g.format);
    if (g.generator) add('Made by', { data: g.generator });
    add('Triangles', { data: fmtNum(g.triangles) });
    add('Parts', { data: fmtNum(g.meshes) });
    add('Materials', { data: fmtNum(g.materials) });
  }

  // Units: STL and PLY don't say, so we guess and let the visitor change it.
  if (!m.scene) {
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', "The file's units");
    for (const [u, label] of [['mm', 'Millimetres'], ['cm', 'Centimetres'], ['m', 'Metres'], ['in', 'Inches']]) {
      const o = document.createElement('option');
      o.value = u; o.textContent = label; o.selected = u === state.unit;
      sel.append(o);
    }
    sel.addEventListener('change', () => { state.unit = sel.value; renderFacts(); });
    add('Units', sel);
  }
  add('Size (W × D × H)', { data: fmtDims(m.size, f) });
  if (m.stats && m.stats.area !== undefined) {
    add('Surface area', { data: fmtArea(m.stats.area * f * f) });
    if (m.stats.openEdges === 0) {
      add('Closed shape', 'Yes, watertight');
      add('Volume', { data: fmtVol(m.stats.volume * f * f * f) });
    } else {
      add('Closed shape', 'No, open edges: ', { data: fmtNum(m.stats.openEdges) });
      add('Volume', 'Not measurable (the shape has holes)');
    }
  }

  // Normals and colour
  if (m.kind === 'stl') {
    const s = m.stl;
    add('Normals', s.storedNormals === s.triangles ? 'Stored in the file'
      : s.storedNormals ? 'Partly stored, worked out from the shape' : 'Not stored, worked out from the shape');
    if (s.colourKind === 'materialise') add('Colour', 'Per triangle (Materialise style), colours: ', { data: fmtNum(s.distinctColours) });
    else if (s.colourKind === 'viscam') add('Colour', 'Per triangle (VisCAM / SolidView style), colours: ', { data: fmtNum(s.distinctColours) });
    else add('Colour', 'None stored');
    if (s.material) add('Material', 'diffuse ', { data: hex(s.material.diffuse) }, ', specular ', { data: hex(s.material.specular) });
    if (s.unknownAttr) add('Extra data', 'Triangle attribute bytes are used, but not as colour');
  } else if (m.kind === 'ply') {
    add('Normals', m.ply.storedNormals ? 'Stored in the file' : m.points ? 'None (point cloud)' : 'Not stored, worked out from the shape');
    add('Colour', m.ply.splat ? 'Per point (Gaussian splat)' : m.hasColour ? 'Per point' : 'None stored');
    if (m.points) add('Shape', 'Points only, no surface');
  } else {
    const g = m.info;
    add('Colour', g.textured ? 'Photo texture' : g.vcol ? 'Per point' : m.hasColour ? 'Material colours' : 'None stored');
  }

  const note = $('sv-info-note');
  note.hidden = true;
  if (m.kind === 'ply' && m.ply.splat) {
    note.textContent = 'This is a Gaussian splat, shown here as coloured points. A splat viewer would blend them into a photo-like image.';
    note.hidden = false;
  }
}

// ---------- showing a loaded model ----------
function clearModel() {
  if (!model) return;
  holder.remove(model.object);
  disposeOwnMaterials();
  model.object.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (model.scene && o.isMesh) {
      for (const m of [].concat(o.userData.fileMaterial || [])) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
    }
  });
  model = null;
}

function show(m, file) {
  clearModel();
  model = m;
  model.bytes = file.size;
  if (m.object.isMesh) m.object.castShadow = true;
  holder.add(m.object);

  state.up = m.up;
  // Units: GLB and USDZ are metres here; otherwise a model under 5 units across is
  // most likely metres (scanners), anything bigger millimetres (CAD, 3D printing).
  m.object.geometry?.computeBoundingBox();
  const raw = new THREE.Box3().setFromObject(m.object).getSize(new THREE.Vector3());
  state.unit = m.unit || (Math.max(raw.x, raw.y, raw.z) <= 5 ? 'm' : 'mm');
  state.colour = m.hasColour ? 'file' : 'single';

  place();
  applyMaterials();
  syncButtons();
  renderFacts();

  drop.classList.add('is-hidden');
  tools.hidden = false;
  panel.hidden = false;
  $('sv-hint').hidden = false;
}

async function openFile(file) {
  if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['stl', 'glb', 'ply', 'usdz'].includes(ext)) {
    showError("That file type isn't supported here. Use an STL, GLB, PLY or USDZ file.");
    return;
  }
  hideError();
  setBusy(true);
  await nextPaint();
  try {
    const buf = await file.arrayBuffer();
    const m = ext === 'stl' ? loadSTL(buf, file.name) : ext === 'ply' ? loadPLY(buf, file.name)
      : ext === 'usdz' ? await loadUSDZ(buf, file.name) : await loadGLB(buf, file.name);
    show(m, file);
  } catch (e) {
    console.error(e);
    showError("Couldn't read that file. It may be damaged, or not really a 3D file.");
  } finally {
    setBusy(false);
  }
}

// ---------- controls ----------
function pressed(attr, value) {
  document.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
}

function syncButtons() {
  pressed('colour', state.colour);
  pressed('light', state.light);
  pressed('finish', state.finish);
  pressed('shade', state.shade);
  pressed('up', state.up);
  const fileBtn = document.querySelector('[data-colour="file"]');
  fileBtn.disabled = !model || !model.hasColour;
  const ownColours = model && model.scene && state.colour === 'file';
  document.querySelectorAll('[data-finish]').forEach(b => { b.disabled = !!(model && (model.points || ownColours)); });
  document.querySelectorAll('[data-shade]').forEach(b => { b.disabled = !!(model && model.points); });
  $('sv-colour').disabled = state.colour !== 'single';
  $('sv-colour').closest('.sv-row').classList.toggle('is-off', state.colour !== 'single');

  const note = $('sv-colour-note');
  if (model && !model.hasColour) {
    note.textContent = model.kind === 'stl'
      ? "This STL has no colour in it: like most STL files it only holds the shape. Scanning apps (Scaniverse, Polycam) keep the colour in their USDZ, GLB, PLY or OBJ exports, so export the scan as USDZ or GLB and open that here to see it in colour."
      : 'This file has no colour in it, so it is shown in one colour.';
    note.hidden = false;
  } else note.hidden = true;
}

function bindSeg(attr, after) {
  document.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    state[attr] = b.dataset[attr];
    syncButtons();
    after();
  }));
}
bindSeg('colour', applyMaterials);
bindSeg('finish', applyMaterials);
bindSeg('shade', applyMaterials);
bindSeg('light', applyLights);
bindSeg('up', () => { if (model) { place(); renderFacts(); } });
$('sv-colour').addEventListener('input', applyMaterials);
$('sv-shadow').addEventListener('change', e => { ground.visible = e.target.checked; key.castShadow = e.target.checked; });
$('sv-spin').addEventListener('change', e => { controls.autoRotate = e.target.checked; });

$('sv-reset').addEventListener('click', resetView);
$('sv-open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { openFile(fileInput.files[0]); fileInput.value = ''; });

$('sv-shot').addEventListener('click', () => {
  renderer.render(scene, camera);   // draw now, so the picture isn't blank
  canvas.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (model ? model.name.replace(/\.[^.]+$/, '') : 'model') + '-view.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
});

const fullBtn = $('sv-full');
if (!stage.requestFullscreen) fullBtn.hidden = true;
fullBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else stage.requestFullscreen().catch(() => {});
});

// Drag and drop onto the stage. The window also swallows drops so a missed
// drop doesn't make the browser navigate away to the file.
let dragDepth = 0;
const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
stage.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.classList.add('is-over'); });
stage.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.classList.remove('is-over'); } });
stage.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  drop.classList.remove('is-over');
  openFile(e.dataTransfer.files[0]);
});
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });

// ---------- size + render loop ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
applyLights();
syncButtons();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
