// La casa che si costruisce scorrendo: pianta → linee 3D → fondamenta → muri → struttura → infissi → tetto → colore.
// Tutto costruito nel codice (nessun file 3D). Le linee spesse sono un piccolo shader nostro che si "disegna" da solo.
import * as THREE from 'three';
import { costruisciGolf } from './golf.js';

const CARTA = 0xf2f0eb;

// ---------- tempi (p = avanzamento dello scroll nella sezione, 0 → 1) ----------
const T = {
  pianta: [0.0, 0.125],
  alza: [0.1, 0.27],
  filo: [0.13, 0.27],
  fondamenta: [0.26, 0.36],
  muri: [0.38, 0.51],
  struttura: [0.53, 0.62],
  vetri: [0.64, 0.73],
  tetto: [0.75, 0.84],
  colore: [0.85, 0.905],
  rivela: [0.915, 0.995],
};
const tra = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const fase = (p, k) => tra(p, T[k][0], T[k][1]);
const morbido = t => t * t * (3 - 2 * t);
const esce = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
// passo i-esimo di n dentro una fase, ognuno lungo "d" (frazione della fase)
const passo = (p, k, i, n, d = 0.45) => {
  const [a, b] = T[k];
  const s = n > 1 ? (1 - d) / (n - 1) : 0;
  return tra(p, a + (b - a) * s * i, a + (b - a) * (s * i + d));
};

// ---------- linee spesse ----------
const VS = /* glsl */`
attribute vec3 iA; attribute vec3 iB; attribute vec2 iT;
uniform float uP; uniform vec2 uRes; uniform float uW;
varying float vVis; varying float vLen; varying vec2 vXZ;
void main(){
  float f = iT.y <= 0. ? 1. : clamp((uP - iT.x) / iT.y, 0., 1.);
  vVis = f;
  vec4 wa = modelMatrix * vec4(iA, 1.);
  vec4 wb = modelMatrix * vec4(mix(iA, iB, f), 1.);
  vec4 ca = projectionMatrix * viewMatrix * wa;
  vec4 cb = projectionMatrix * viewMatrix * wb;
  float asp = uRes.x / uRes.y;
  vec2 d = cb.xy / cb.w - ca.xy / ca.w; d.x *= asp;
  float L = length(d);
  d = L > 1e-6 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x); n.x /= asp;
  vec2 dn = d; dn.x /= asp;
  bool fine = position.x > .5;
  vec4 c = fine ? cb : ca;
  vXZ = (fine ? wb : wa).xz;
  c.xy += (n * position.y + dn * (fine ? .5 : -.5)) * (uW / uRes.y) * c.w;
  vLen = fine ? L * uRes.y * .5 : 0.;
  gl_Position = c;
}`;
const FS = /* glsl */`
uniform vec3 uCol; uniform float uOp; uniform float uDash; uniform vec3 uFade;
varying float vVis; varying float vLen; varying vec2 vXZ;
void main(){
  if (vVis <= 0.) discard;
  if (uDash > 0. && mod(vLen, uDash * 2.) > uDash) discard;
  float a = uOp;
  if (uFade.z > 0.) a *= 1. - smoothstep(uFade.x, uFade.z, length(vXZ - vec2(2.5, 3.5)));
  if (a <= 0.003) discard;
  gl_FragColor = vec4(uCol, a);
  #include <colorspace_fragment>
}`;

class Tratti {
  constructor() { this.v = []; }
  seg(a, b, t0 = -1, dur = -1) { this.v.push(...a, ...b, t0, dur); return this; }
  // il "pennino" percorre la spezzata a velocità costante tra t0 e t0+dur
  linea(punti, t0 = -1, dur = -1, chiusa = false) {
    const lati = [];
    let tot = 0;
    const n = chiusa ? punti.length : punti.length - 1;
    for (let i = 0; i < n; i++) {
      const a = punti[i], b = punti[(i + 1) % punti.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      lati.push([a, b, L]); tot += L;
    }
    let t = t0;
    for (const [a, b, L] of lati) {
      if (dur > 0) { const d = dur * L / tot; this.seg(a, b, t, d); t += d; } else this.seg(a, b);
    }
    return this;
  }
  rett(x0, z0, x1, z1, y, t0, dur) { return this.linea([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], t0, dur, true); }
  cerchio(x, z, r, y, t0, dur, n = 28) {
    const p = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); }
    return this.linea(p, t0, dur, true);
  }
  mesh(mat) {
    const n = this.v.length / 8;
    const A = new Float32Array(n * 3), B = new Float32Array(n * 3), Tm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      A.set(this.v.slice(o, o + 3), i * 3); B.set(this.v.slice(o + 3, o + 6), i * 3); Tm.set(this.v.slice(o + 6, o + 8), i * 2);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 3));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 3));
    g.setAttribute('iT', new THREE.InstancedBufferAttribute(Tm, 2));
    g.instanceCount = n;
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
  }
}

export async function avvia(canvas, { telefono = false, ferma = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, telefono ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(CARTA, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 4, 900);

  // ---------- materiali delle linee ----------
  const tutteLeLinee = [];
  const ml = (colore, spessore, opacita = 1, tratteggio = 0, sfuma = null) => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uP: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: spessore * dpr },
        uCol: { value: new THREE.Color(colore) }, uOp: { value: opacita }, uDash: { value: tratteggio * dpr },
        uFade: { value: new THREE.Vector3(sfuma ? sfuma[0] : 0, 0, sfuma ? sfuma[1] : 0) },
      },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    });
    tutteLeLinee.push(m);
    return m;
  };
  const GRAF = 0x2a2723, ORO = 0xc4900f;
  const mGriglia = ml(GRAF, 1, 0.07, 0, [16, 40]);
  const mGrigliaForte = ml(GRAF, 1, 0.12, 0, [16, 40]);
  const mCostruzione = ml(GRAF, 1, 0.38, 5);
  const mPianta = ml(GRAF, 1.5, 0.95);
  const mPiantaFuori = ml(GRAF, 1.1, 0.6);
  const mQuote = ml(ORO, 1.3, 1);
  const mRiferimenti = ml(GRAF, 1, 0.4, 3);
  const mFilo = ml(GRAF, 1.3, 0.85);
  const mBordi = ml(GRAF, 1.25, 1);

  // ---------- materiali delle superfici ----------
  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra });
  const colori = []; // [materiale, colore plastico, colore vero]
  const mat = (bianco, vero, extra) => { const m = lam(bianco, extra); colori.push([m, new THREE.Color(bianco), new THREE.Color(vero)]); return m; };
  const mMuro = mat(0xfbfaf7, 0xe8dfcf);
  const mTetto = mat(0xf8f6f2, 0xb5643f);
  const mPlinto = mat(0xf3f1ec, 0xcfc7b8);
  const mPatio = mat(0xf5f3ef, 0xddd5c6);
  const mBordo = mat(0xf8f7f3, 0xf0ece4);
  const mAcqua = mat(0xebe9e4, 0x79bfd0);
  const mVetro = mat(0xc3cacc, 0x3b484e, { side: THREE.DoubleSide });
  const mLegno = mat(0xf8f6f2, 0x8b6b4d);
  const mRinghiera = new THREE.MeshLambertMaterial({ color: 0xd3dcde, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const mPrato = new THREE.MeshLambertMaterial({ color: 0xa8bc86, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const mSiepe = lam(0x5f7a4c);
  const mCipresso = lam(0x4f6b45, { flatShading: true });
  const mChioma = lam(0x7c9660, { flatShading: true });
  const mTronco = lam(0x7a6a58);

  // ---------- luci e ombre ----------
  scena.add(new THREE.HemisphereLight(0xffffff, 0xe6e0d4, 1.35));
  const sole = new THREE.DirectionalLight(0xfff4e6, 2.1);
  sole.position.set(-12, 24, 16);
  sole.target.position.set(2.5, 0, 3.5);
  sole.castShadow = true;
  sole.shadow.mapSize.set(telefono ? 1024 : 2048, telefono ? 1024 : 2048);
  Object.assign(sole.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.02;
  scena.add(sole, sole.target);
  const mOmbra = new THREE.ShadowMaterial({ opacity: 0, depthWrite: false });
  const terreno = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mOmbra);
  terreno.rotation.x = -Math.PI / 2;
  terreno.position.y = 0.001;
  terreno.receiveShadow = true;
  scena.add(terreno);

  const prato = new THREE.Mesh(new THREE.PlaneGeometry(33, 25), mPrato);
  prato.rotation.x = -Math.PI / 2;
  prato.position.set(2.5, 0.01, 3.5);
  prato.receiveShadow = true;
  scena.add(prato);

  // ---------- griglia ----------
  {
    const g = new Tratti(), gf = new Tratti();
    for (let i = -40; i <= 40; i++) {
      const t = i % 5 === 0 ? gf : g;
      t.seg([i + 2.5, 0.006, -40 + 3.5], [i + 2.5, 0.006, 40 + 3.5]);
      t.seg([-40 + 2.5, 0.006, i + 3.5], [40 + 2.5, 0.006, i + 3.5]);
    }
    scena.add(g.mesh(mGriglia), gf.mesh(mGrigliaForte));
  }

  // ---------- misure della casa ----------
  const BASE = 0.45;                    // piano del plinto
  const PIANO = BASE + 3.0;             // primo piano
  const sotto = z => 6.05 + (5 - Math.abs(z)) * 0.33; // intradosso del tetto
  const yTop = 6.3, yColmo = yTop + 5 * 0.33;

  // ---------- pianta disegnata ----------
  {
    const y = 0.012;
    const c = new Tratti();
    // linee di costruzione lunghe, tratteggiate
    const L = [[-13.5, 17.5]];
    [-4.5, 4.5, 3, -4].forEach((z, i) => c.seg([L[0][0], y, z], [L[0][1], y, z], 0.0 + i * 0.006, 0.03));
    [-8, 8, 13.5].forEach((x, i) => c.seg([x, y, -8.5], [x, y, 15], 0.012 + i * 0.006, 0.03));
    scena.add(c.mesh(mCostruzione));

    const p = new Tratti();
    p.rett(-8, -4.5, 8, 4.5, y, 0.035, 0.025);          // muro esterno A
    p.rett(-7.7, -4.2, 7.7, 4.2, y, 0.052, 0.018);      // muro interno A
    p.linea([[8, y, -4], [13.5, y, -4], [13.5, y, 3], [8, y, 3]], 0.062, 0.014);
    p.linea([[8, y, -3.7], [13.2, y, -3.7], [13.2, y, 2.7], [8, y, 2.7]], 0.07, 0.012);
    p.seg([-2, y, -4.2], [-2, y, 0.6], 0.078, 0.006);    // tramezzi
    p.seg([-7.7, y, 0.6], [-4.2, y, 0.6], 0.08, 0.005);
    p.seg([3, y, -4.2], [3, y, 4.2], 0.082, 0.006);
    p.seg([3, y, -0.6], [7.7, y, -0.6], 0.085, 0.005);
    p.rett(-8.25, 4.75, 13.75, 7.8, y, 0.086, 0.01);     // patio
    p.rett(0.6, 8.8, 11.4, 13.6, y, 0.09, 0.008);       // piscina
    p.rett(1, 9.2, 11, 13.2, y, 0.094, 0.008);
    [-7.7, -5.4, -3.1].forEach((x, i) => p.rett(x - 0.12, 7.38, x + 0.12, 7.62, y, 0.096 + i * 0.002, 0.003));
    scena.add(p.mesh(mPianta));

    const f = new Tratti();
    f.rett(-14, -9, 19, 16, y, 0.098, 0.016);           // confine del lotto
    const alberi = [[-12.3, -7, 1.0], [-12.3, -4, 1.0], [-12.3, -1, 1.0], [16.4, 11.6, 2.1], [-10.6, 12.2, 2.2], [16.6, -6, 1.9]];
    alberi.forEach(([x, z, r], i) => {
      f.cerchio(x, z, r, y, 0.1 + i * 0.003, 0.008);
      if (r > 1.5) { f.seg([x - r * 0.5, y, z], [x + r * 0.5, y, z], 0.11, 0.003); f.seg([x, y, z - r * 0.5], [x, y, z + r * 0.5], 0.112, 0.003); }
    });
    var piantaFuori = f.mesh(mPiantaFuori);
    scena.add(piantaFuori);

    // quote (oro) e linee di richiamo
    const q = new Tratti(), r = new Tratti();
    const zq = -7.2, xq = -10.9;
    q.seg([-8, y, zq], [13.5, y, zq], 0.104, 0.012);
    [-8, 8, 13.5].forEach(x => q.seg([x - 0.35, y, zq + 0.35], [x + 0.35, y, zq - 0.35], 0.112, 0.004));
    q.seg([xq, y, -4.5], [xq, y, 4.5], 0.108, 0.01);
    [-4.5, 4.5].forEach(z => q.seg([xq - 0.35, y, z + 0.35], [xq + 0.35, y, z - 0.35], 0.115, 0.004));
    [[-8, -4.75], [8, -4.75], [13.5, -4.25]].forEach(([x, z]) => r.seg([x, y, z], [x, y, zq - 0.6], 0.1, 0.008));
    [-4.5, 4.5].forEach(z => r.seg([-8.25, y, z], [xq - 0.6, y, z], 0.1, 0.008));
    var quote = q.mesh(mQuote), richiami = r.mesh(mRiferimenti);
    scena.add(quote, richiami);
  }

  // etichette delle quote
  const etichette = [];
  {
    await document.fonts.load('500 64px Archivo').catch(() => {});
    const crea = (testo, x, z, ruota = 0) => {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 96;
      const c = cv.getContext('2d');
      c.font = '500 60px Archivo, sans-serif';
      c.fillStyle = '#a57a0c';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(testo, 128, 50);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, rotation: ruota }));
      const k = telefono ? 1.7 : 1.15;
      s.scale.set(2.67 * k, 1 * k, 1);
      s.position.set(x, 0.05, z);
      s.renderOrder = 3;
      scena.add(s);
      etichette.push(s);
    };
    crea('16,00', 0, -7.95);
    crea('5,50', 10.75, -7.95);
    crea('9,00', -11.75, 0, Math.PI / 2);
  }

  // ---------- filo 3D (il disegno che si alza) ----------
  {
    const w = new Tratti();
    const a = T.filo[0], d = T.filo[1] - T.filo[0];
    const at = (x0, x1) => [a + d * x0, d * (x1 - x0)];
    const angA = [[-8, -4.5], [8, -4.5], [8, 4.5], [-8, 4.5]];
    angA.forEach(([x, z], i) => w.seg([x, BASE, z], [x, sotto(4.5), z], ...at(0.0 + i * 0.04, 0.22 + i * 0.04)));
    [[13.5, -4], [13.5, 3]].forEach(([x, z], i) => w.seg([x, BASE, z], [x, PIANO, z], ...at(0.12 + i * 0.04, 0.3 + i * 0.04)));
    w.linea([...angA.map(([x, z]) => [x, sotto(4.5), z])], ...at(0.3, 0.55), true);
    w.linea([[8, PIANO, -4], [13.5, PIANO, -4], [13.5, PIANO, 3], [8, PIANO, 3]], ...at(0.36, 0.55));
    [-8, 8].forEach((x, i) => w.linea([[x, sotto(4.5), -4.5], [x, yColmo - 0.25, 0], [x, sotto(4.5), 4.5]], ...at(0.52 + i * 0.06, 0.72 + i * 0.06)));
    w.seg([-8.5, yColmo, 0], [8.5, yColmo, 0], ...at(0.68, 0.86));
    w.linea([[-8.5, yTop, -5], [8.5, yTop, -5], [8.5, yTop, 5], [-8.5, yTop, 5]], ...at(0.72, 0.95), true);
    [[-8.5, -5], [8.5, -5], [8.5, 5], [-8.5, 5]].forEach(([x, z], i) => w.seg([x, yTop, z], [x, yColmo, 0], ...at(0.8 + i * 0.03, 0.9 + i * 0.03)));
    var filo = w.mesh(mFilo);
    scena.add(filo);
  }

  // ---------- pezzi solidi ----------
  const conBordi = (mesh, soglia = 25) => {
    const e = new THREE.EdgesGeometry(mesh.geometry, soglia).attributes.position.array;
    const t = new Tratti();
    for (let i = 0; i < e.length; i += 6) t.seg([e[i], e[i + 1], e[i + 2]], [e[i + 3], e[i + 4], e[i + 5]]);
    mesh.add(t.mesh(mBordi));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const scatola = (x0, y0, z0, x1, y1, z1, m) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return conBordi(new THREE.Mesh(g, m));
  };
  // pezzo che cresce da un punto d'appoggio: il gruppo sta sul "perno" e scala attorno a lui
  const cresceGeo = (perno, mesh) => { const g = new THREE.Group(); g.position.copy(perno); mesh.position.sub(perno); g.add(mesh); g.visible = false; scena.add(g); return g; };

  // fondamenta
  const fondamenta = [
    cresceGeo(new THREE.Vector3(0, 0, 0), scatola(-8.25, 0, -4.75, 8.25, BASE, 4.75, mPlinto)),
    cresceGeo(new THREE.Vector3(10.9, 0, 0), scatola(8, 0, -4.25, 13.75, BASE, 3.25, mPlinto)),
    cresceGeo(new THREE.Vector3(2.75, 0, 6.3), scatola(-8.25, 0, 4.75, 13.75, 0.15, 7.8, mPatio)),
  ];
  {
    const g = new THREE.Group();
    g.add(scatola(0.6, 0, 8.8, 11.4, 0.12, 9.2, mBordo), scatola(0.6, 0, 13.2, 11.4, 0.12, 13.6, mBordo),
      scatola(0.6, 0, 9.2, 1, 0.12, 13.2, mBordo), scatola(11, 0, 9.2, 11.4, 0.12, 13.2, mBordo));
    const acqua = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), mAcqua);
    acqua.rotation.x = -Math.PI / 2; acqua.position.set(6, 0.06, 11.2); acqua.receiveShadow = true;
    g.add(acqua);
    g.children.forEach(c => c.position.sub(new THREE.Vector3(6, 0, 11.2)));
    g.position.set(6, 0, 11.2);
    scena.add(g);
    fondamenta.push(g);
  }

  // muri con le aperture vere (ExtrudeGeometry con i buchi)
  const vetri = [];
  const muro = ({ contorno, buchi = [], pos, ruota = 0 }) => {
    const s = new THREE.Shape(contorno.map(([u, v]) => new THREE.Vector2(u, v)));
    buchi.forEach(([u0, u1, v0, v1]) => s.holes.push(new THREE.Path([new THREE.Vector2(u0, v0), new THREE.Vector2(u1, v0), new THREE.Vector2(u1, v1), new THREE.Vector2(u0, v1)])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 1 });
    const m = conBordi(new THREE.Mesh(geo, mMuro), 20);
    m.position.set(pos[0], 0, pos[2]);
    m.rotation.y = ruota;
    buchi.forEach(([u0, u1, v0, v1]) => {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0), mVetro);
      v.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0.16);
      v.scale.setScalar(0.0001);
      v.visible = false;
      v.receiveShadow = true;
      m.add(v);
      vetri.push(v);
    });
    const g = new THREE.Group();
    g.position.y = BASE;
    g.add(m);
    g.scale.y = 0.0001;
    g.visible = false;
    scena.add(g);
    return g;
  };
  const hL = sotto(4.5) - BASE;                       // altezza dei muri lunghi
  const timpano = (u) => [[-u, 0], [u, 0], [u, sotto(u) - BASE], [0, sotto(0) - BASE], [-u, sotto(u) - BASE]];
  const muri = [
    muro({ contorno: [[-8, 0], [8, 0], [8, hL], [-8, hL]], pos: [0, 0, 4.2],
      buchi: [[-6.8, -4.2, 0.05, 2.4], [-3, -0.4, 0.05, 2.4], [1.6, 4.4, 0.05, 2.4], [5.4, 6.6, 0.05, 2.3], [-6.2, -4.8, 3.9, 5.3], [-2.4, -1, 3.9, 5.3], [1.6, 3, 3, 5.4], [4.4, 5.8, 3, 5.4]] }),
    muro({ contorno: timpano(4.2), pos: [-7.7, 0, 0], ruota: -Math.PI / 2,
      buchi: [[-1, 1, 0.9, 2.3], [-0.6, 0.6, 3.9, 5.3]] }),
    muro({ contorno: [[8, 0], [13.5, 0], [13.5, 3], [8, 3]], pos: [0, 0, 2.7], buchi: [[9, 12.8, 0.05, 2.4]] }),
    muro({ contorno: [[-3.7, 0], [2.7, 0], [2.7, 3], [-3.7, 3]], pos: [13.5, 0, 0], ruota: -Math.PI / 2, buchi: [[-1.5, 0.5, 0.9, 2.3]] }),
    muro({ contorno: timpano(4.2), pos: [8, 0, 0], ruota: -Math.PI / 2, buchi: [[-1.2, 0.6, 3.27, 5.4]] }),
    muro({ contorno: [[8, 0], [13.5, 0], [13.5, 3], [8, 3]], pos: [0, 0, -4], buchi: [[10, 11.4, 0.9, 2.3]] }),
    muro({ contorno: [[-8, 0], [8, 0], [8, hL], [-8, hL]], pos: [0, 0, -4.5],
      buchi: [[-6, -4.8, 0.9, 2.3], [-1.2, 0, 0.9, 2.3], [4, 5.2, 0.9, 2.3], [-6, -4.8, 3.9, 5.3], [-1.2, 0, 3.9, 5.3], [4, 5.2, 3.9, 5.3]] }),
  ];

  // struttura: solaio dell'ala, balcone, pergola, parapetti di vetro
  const vetroPiano = (w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mRinghiera);
    m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 1;
    return m;
  };
  const struttura = [];
  {
    const add = (perno, obj, asse = 'y') => { const g = cresceGeo(perno, obj); g.userData.asse = asse; struttura.push(g); g.visible = false; return g; };
    add(new THREE.Vector3(10.8, PIANO, -0.5), scatola(7.95, PIANO, -4.15, 13.65, PIANO + 0.27, 3.15, mPlinto), 'xz');
    add(new THREE.Vector3(3.8, PIANO, 4.5), scatola(0.8, PIANO - 0.18, 4.5, 6.8, PIANO, 5.9, mPlinto), 'z');
    [-7.7, -5.4, -3.1].forEach(x => add(new THREE.Vector3(x, 0.15, 7.5), scatola(x - 0.09, 0.15, 7.41, x + 0.09, 2.95, 7.59, mLegno)));
    add(new THREE.Vector3(-8, 2.95, 7.5), scatola(-8, 2.95, 7.4, -2.8, 3.13, 7.6, mLegno), 'x');
    add(new THREE.Vector3(-8, 2.95, 4.5), scatola(-8, 2.95, 4.5, -2.8, 3.13, 4.68, mLegno), 'x');
    const doghe = new THREE.Group();
    for (let x = -7.6; x <= -3.0; x += 0.58) doghe.add(scatola(x - 0.04, 3.13, 4.5, x + 0.04, 3.27, 7.65, mLegno));
    doghe.position.set(0, 0, 0);
    { const g = new THREE.Group(); g.position.set(0, 3.13, 4.5); doghe.position.set(0, -3.13, -4.5); g.add(doghe); g.userData.asse = 'z'; g.visible = false; scena.add(g); struttura.push(g); }
    const rg = new THREE.Group();
    rg.add(vetroPiano(6, 1, 3.8, PIANO + 0.5, 5.9), vetroPiano(1.4, 1, 0.8, PIANO + 0.5, 5.2, Math.PI / 2), vetroPiano(1.4, 1, 6.8, PIANO + 0.5, 5.2, Math.PI / 2),
      vetroPiano(5.7, 1, 10.8, PIANO + 0.77, 3.15), vetroPiano(7.3, 1, 13.65, PIANO + 0.77, -0.5, Math.PI / 2), vetroPiano(5.7, 1, 10.8, PIANO + 0.77, -4.15));
    const rgP = new THREE.Group(); rgP.position.set(0, PIANO, 0); rg.position.set(0, -PIANO, 0); rgP.add(rg); rgP.userData.asse = 'y'; rgP.visible = false; scena.add(rgP); struttura.push(rgP);
  }

  // tetto a due falde con un po' di spessore, e il camino
  let tetto, camino;
  {
    const sp = 0.25;
    const s = new THREE.Shape([[-5, yTop], [0, yColmo], [5, yTop], [5, yTop - sp], [0, yColmo - sp], [-5, yTop - sp]].map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: 17, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);       // estrusione lungo x
    geo.translate(-8.5, 0, 0);
    const m = conBordi(new THREE.Mesh(geo, mTetto), 20);
    tetto = new THREE.Group(); tetto.add(m); tetto.visible = false; scena.add(tetto);
    const c = new THREE.Group();
    c.add(scatola(3.2, 6.9, -2.35, 3.9, 8.55, -1.65, mMuro), scatola(3.08, 8.55, -2.47, 4.02, 8.7, -1.53, mTetto));
    c.children.forEach(x => x.position.y -= 6.9);
    c.position.y = 6.9;
    c.visible = false;
    scena.add(c);
    camino = c;
  }

  // verde: siepi, cipressi, alberi (arrivano col colore)
  const verde = [];
  {
    const siepe = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.1, z1 - z0), mSiepe); m.geometry.translate(0, 0.55, 0); m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; return m; };
    [siepe(-14, -9.4, 19, -8.6), siepe(-14.4, -9, -13.6, 16), siepe(18.6, -9, 19.4, 16), siepe(-14, 15.6, -10.5, 16.4), siepe(-6.5, 15.6, 19, 16.4)].forEach(m => { scena.add(m); verde.push(m); });
    const cipresso = (x, z) => {
      const g = new THREE.Group();
      const ch = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.4, 7), mCipresso); ch.position.y = 3.6; ch.castShadow = true;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6), mTronco); tr.position.y = 0.3;
      g.add(ch, tr); g.position.set(x, 0, z); return g;
    };
    const albero = (x, z, r) => {
      const g = new THREE.Group();
      const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mChioma); ch.position.y = 2.3 + r * 0.8; ch.scale.y = 0.85; ch.castShadow = true;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6), mTronco); tr.position.y = 1.3; tr.castShadow = true;
      g.add(ch, tr); g.position.set(x, 0, z); return g;
    };
    [cipresso(-12.3, -7), cipresso(-12.3, -4), cipresso(-12.3, -1), albero(16.4, 11.6, 2.1), albero(-10.6, 12.2, 2.2), albero(16.6, -6, 1.9)]
      .forEach(g => { g.scale.setScalar(0.0001); g.visible = false; scena.add(g); verde.push(g); });
  }

  // ---------- il finale: Ca' Amata e il campo da golf intorno ----------
  const avanzaGolf = costruisciGolf(scena, { conBordi, lam });

  // ---------- camera ----------
  const bersaglio = new THREE.Vector3();
  let W = 1, H = 1, rPianta = 60, rProsp = 50, rFine = 60, telefonoVista = telefono;
  const dimensiona = () => {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    telefonoVista = W < 760;
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const quotaW = telefonoVista ? 0.94 : 0.6, quotaH = telefonoVista ? 0.6 : 0.86;
    const th = tv * camera.aspect * quotaW, tvv = tv * quotaH;
    const kt = telefonoVista ? 0.86 : 1;   // sul telefono si sta più stretti: la casa più grande
    rPianta = Math.max(17.8 / th, 13.6 / tvv) * (telefonoVista ? 1.04 : 1);
    rProsp = Math.max(15.5 / th, 12.5 / tvv) * kt;
    rFine = Math.max(19.5 / th, 15.5 / tvv) * kt;
    if (telefonoVista) camera.setViewOffset(W, H, 0, H * 0.09, W, H);
    else camera.setViewOffset(W, H, -W * 0.19, 0, W, H);
    camera.updateProjectionMatrix();
    const res = new THREE.Vector2();
    renderer.getDrawingBufferSize(res);
    tutteLeLinee.forEach(m => m.uniforms.uRes.value.copy(res));
    disegna(pS);
  };

  const piazzaCamera = (p) => {
    const k = morbido(fase(p, 'alza'));
    const dopo = morbido(tra(p, T.alza[1], 1));
    const rv0 = morbido(fase(p, 'rivela'));
    const phi = lerp(lerp(0.06, 1.0, k) + 0.08 * dopo, 0.9, rv0);
    const theta = lerp(0.0, 0.62, k) + 0.3 * dopo + 0.12 * rv0;
    const col = morbido(fase(p, 'colore'));
    const rv = morbido(fase(p, 'rivela'));
    const r = lerp(lerp(lerp(rPianta, rProsp, k) * (1 - 0.05 * dopo), rFine, col), rFine * (telefonoVista ? 2.25 : 2.45), rv);
    bersaglio.set(lerp(2.6, 7, rv), lerp(lerp(lerp(0, 2.4, k), 1.2, col), 0, rv), lerp(lerp(lerp(3.5, 2.4, k), 3.2, col), -9, rv));
    camera.position.set(
      bersaglio.x + r * Math.sin(phi) * Math.sin(theta),
      bersaglio.y + r * Math.cos(phi),
      bersaglio.z + r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(bersaglio);
  };

  // ---------- disegno di uno stato ----------
  let intro = ferma ? 1 : 0;
  const scala = (g, t, asse = 'y') => {
    const v = Math.max(0.0001, esce(t));
    g.visible = t > 0;
    if (asse === 'y') g.scale.set(1, v, 1);
    else if (asse === 'x') g.scale.set(v, 1, 1);
    else if (asse === 'z') g.scale.set(1, 1, v);
    else g.scale.set(v, 1, v);
  };
  function disegna(p) {
    const pl = Math.max(p, intro * 0.05);
    tutteLeLinee.forEach(m => { m.uniforms.uP.value = pl; });

    const col = morbido(fase(p, 'colore'));
    const fond = fase(p, 'fondamenta');
    // griglia e pianta
    const visGriglia = Math.min(1, intro * 1.4 + p * 20);
    mGriglia.uniforms.uOp.value = 0.07 * visGriglia * (1 - 0.5 * col);
    mGrigliaForte.uniforms.uOp.value = 0.12 * visGriglia * (1 - 0.5 * col);
    mCostruzione.uniforms.uOp.value = 0.38 * (1 - tra(p, 0.27, 0.42));
    mPianta.uniforms.uOp.value = 0.95 * (1 - tra(p, 0.3, 0.42));
    mPiantaFuori.uniforms.uOp.value = 0.6 * (1 - col);
    const vq = 1 - tra(p, 0.22, 0.3);
    mQuote.uniforms.uOp.value = vq;
    mRiferimenti.uniforms.uOp.value = 0.4 * vq;
    const ve = tra(p, 0.1, 0.13) * vq;
    etichette.forEach(s => { s.material.opacity = ve; s.visible = ve > 0.01; });
    mFilo.uniforms.uOp.value = lerp(0.85, 0.16, tra(p, 0.3, 0.5)) * (1 - col);
    mBordi.uniforms.uOp.value = 1 - 0.68 * col;

    // fondamenta
    fondamenta.forEach((g, i) => scala(g, passo(p, 'fondamenta', i, fondamenta.length, 0.5)));
    mOmbra.opacity = 0.16 * fond;
    // muri
    muri.forEach((g, i) => scala(g, passo(p, 'muri', i, muri.length, 0.4)));
    // struttura
    struttura.forEach((g, i) => scala(g, passo(p, 'struttura', i, struttura.length, 0.35), g.userData.asse));
    // vetri
    vetri.forEach((v, i) => { const t = esce(passo(p, 'vetri', i, vetri.length, 0.3)); v.visible = t > 0; v.scale.set(Math.max(0.0001, t), Math.max(0.0001, t), 1); });
    // tetto: scende dall'alto
    const tt = tra(p, T.tetto[0], T.tetto[1] - 0.025);
    tetto.visible = tt > 0;
    tetto.position.y = lerp(3.2, 0, esce(tt));
    camino.visible = tra(p, T.tetto[1] - 0.03, T.tetto[1]) > 0;
    camino.scale.y = Math.max(0.0001, esce(tra(p, T.tetto[1] - 0.03, T.tetto[1])));
    // colore
    colori.forEach(([m, a, b]) => m.color.copy(a).lerp(b, col));
    mPrato.opacity = col;
    verde.forEach((g, i) => {
      const t = esce(tra(p, T.colore[0] + i * 0.006, T.colore[0] + 0.04 + i * 0.006));
      g.visible = t > 0;
      if (g.children.length) g.scale.setScalar(Math.max(0.0001, t)); else g.scale.set(1, Math.max(0.0001, t), 1);
    });

    const rv = fase(p, 'rivela');
    avanzaGolf(rv);
    mOmbra.opacity *= 1 - rv;
    mGriglia.uniforms.uOp.value *= 1 - rv;
    mGrigliaForte.uniforms.uOp.value *= 1 - rv;

    piazzaCamera(p);
    renderer.render(scena, camera);
  }

  // ---------- ciclo: disegna solo quando serve ----------
  let pT = ferma ? 1 : 0, pS = pT, attivo = true, inCorso = false, ultimo = 0, inizioIntro = null;
  const giro = (ora) => {
    const dt = Math.min(0.05, (ora - (ultimo || ora)) / 1000);
    ultimo = ora;
    if (intro < 1) { inizioIntro ??= ora; intro = Math.min(1, (ora - inizioIntro) / 1700); }
    pS += (pT - pS) * (1 - Math.exp(-dt * 7.5));
    if (Math.abs(pT - pS) < 0.00005) pS = pT;
    disegna(pS);
    if (attivo && (pS !== pT || intro < 1)) requestAnimationFrame(giro);
    else { inCorso = false; ultimo = 0; }
  };
  const sveglia = () => { if (!inCorso && attivo) { inCorso = true; requestAnimationFrame(giro); } };

  dimensiona();
  sveglia();

  return {
    imposta(p) { if (ferma) return; pT = p; sveglia(); },
    attiva(si) { attivo = si; if (si) sveglia(); },
    dimensiona,
    stato: () => ({ pT, pS, intro, attivo, inCorso, W, H }),
  };
}
