// Il finale: intorno alla villa compare Ca' Amata (le due palazzine dei render, piscina, strada, cancello)
// e il campo da golf, come un plastico sul tavolo. Tutto in codice, colori pieni (arriva dopo la fase "colore").
import * as THREE from 'three';

// numeri casuali ripetibili
const casuale = (s => () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)), ((s ^= s >>> 16) >>> 0) / 4294967296))(20261006);

export function costruisciGolf(scena, { conBordi, lam }) {
  const C = new THREE.Vector2(2.5, 3.5);       // centro del lotto della villa
  const pezzi = [];                            // { obj, modo: 'su' | 'piano', d }
  const M = {
    tavola: lam(0xb8c79a), lato: lam(0xf6f4ef), fairway: lam(0xa2c07a), green: lam(0x8cb866), sabbia: lam(0xeadfc4),
    lago: lam(0x86bccb), asfalto: lam(0x6c6e70), riga: lam(0xf2f0eb), marciapiede: lam(0xe3ddd0), lavanda: lam(0xa596c8, { flatShading: true }),
    muro: lam(0xe8dfcf), tetto: lam(0xb5643f), pannelli: lam(0x3c4b5b), vetro: lam(0x3b484e, { side: THREE.DoubleSide }), fioriera: lam(0x6d8f50, { flatShading: true }),
    soletta: lam(0xefebe3), tettoia: lam(0xdcd7cd), nero: lam(0x2d2c2a), bandiera: lam(0xd49c1c, { side: THREE.DoubleSide }), palo: lam(0xf2f0eb),
    cipresso: lam(0x4f6b45, { flatShading: true }), chioma: lam(0x7c9660, { flatShading: true }), tronco: lam(0x7a6a58), lettino: lam(0xfbfaf7),
  };

  // un pezzo con il perno in basso al centro (per crescere dal suolo o allargarsi sul piano)
  const pezzo = (geo, mat, { modo = 'su', bordi = false } = {}) => {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const c = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
    geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(c);
    if (bordi) { conBordi(m, 25); m.castShadow = false; }
    m.receiveShadow = true;
    m.visible = false;
    scena.add(m);
    pezzi.push({ obj: m, modo, d: Math.hypot(c.x - C.x, c.z - C.y) });
    return m;
  };
  const scatola = (x0, y0, z0, x1, y1, z1, mat, opz) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return pezzo(g, mat, opz);
  };
  const ellisse = (x, z, rx, rz, ang, y, mat) => {
    const g = new THREE.CircleGeometry(1, 36);
    g.rotateX(-Math.PI / 2); g.scale(rx, 1, rz); g.rotateY(ang); g.translate(x, y, z);
    return pezzo(g, mat, { modo: 'piano' });
  };

  // ---------- la tavola del plastico ----------
  const tavola = new THREE.Group();
  {
    const g = new THREE.BoxGeometry(124, 1.2, 112);
    g.translate(0, -0.602, 0);
    const top = new THREE.Mesh(g, [M.lato, M.lato, M.tavola, M.lato, M.lato, M.lato]);
    top.receiveShadow = true;
    conBordi(top, 25);
    top.castShadow = false;
    top.position.set(6 - C.x, 0, -6 - C.y);
    tavola.add(top);
    tavola.position.set(C.x, 0, C.y);
    tavola.visible = false;
    scena.add(tavola);
  }

  // ---------- la strada davanti (render dall'alto: strisce, marciapiedi, aiuole di lavanda, cancello nero) ----------
  scatola(-56, 0, 20.2, 68, 0.03, 26.8, M.asfalto, { modo: 'piano' });
  for (let x = -52; x < 66; x += 6) scatola(x, 0.03, 23.38, x + 3, 0.045, 23.62, M.riga, { modo: 'piano' });
  for (let i = 0; i < 7; i++) { const x = -11.6 + i * 0.75; scatola(x, 0.03, 20.6, x + 0.42, 0.045, 26.4, M.riga, { modo: 'piano' }); }
  scatola(-56, 0, 17.6, 68, 0.14, 20.2, M.marciapiede, { modo: 'piano' });
  scatola(-56, 0, 26.8, 68, 0.14, 29, M.marciapiede, { modo: 'piano' });
  scatola(-50, 0, 16.6, -11.2, 0.55, 17.4, M.lavanda);
  scatola(-5.8, 0, 16.6, 60, 0.55, 17.4, M.lavanda);
  scatola(-11.2, 0, 15.6, -10.4, 2.1, 16.4, M.muro, { bordi: true });
  scatola(-6.6, 0, 15.6, -5.8, 2.1, 16.4, M.muro, { bordi: true });
  scatola(-10.4, 0.1, 15.95, -6.6, 1.7, 16.05, M.nero);
  [-40, -24, 2, 20, 38, 54].forEach(x => { scatola(x - 0.07, 0, 18.4, x + 0.07, 4.2, 18.54, M.nero); scatola(x - 0.25, 4.2, 18.3, x + 0.25, 4.36, 18.64, M.nero); });

  // ---------- le due palazzine di Ca' Amata ----------
  const finestre = [];                  // [x, y, z, w, h, rotY]
  const palazzina = ({ x0, z0, x1, z1, lungoX, cortile }) => {
    const H = 6.4, sp = 0.6, pend = 0.33;
    scatola(x0, 0, z0, x1, H, z1, M.muro, { bordi: true });
    const L = lungoX ? x1 - x0 : z1 - z0, P = lungoX ? z1 - z0 : x1 - x0;
    const sh = new THREE.Shape([[-P / 2 - sp, H], [0, H + (P / 2 + sp) * pend], [P / 2 + sp, H], [P / 2 + sp, H - 0.22], [0, H - 0.22 + (P / 2 + sp) * pend], [-P / 2 - sp, H - 0.22]].map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: L + sp * 2, bevelEnabled: false });
    if (lungoX) { g.rotateY(Math.PI / 2); g.translate(x0 - sp, 0, (z0 + z1) / 2); }
    else g.translate((x0 + x1) / 2, 0, z0 - sp);
    pezzo(g, M.tetto, { bordi: true });
    // pannelli solari su una falda (come nei render)
    const ang = Math.atan(pend), lp = L * 0.62, wp = (P / 2 + sp) * 0.72 / Math.cos(ang);
    const gp = new THREE.BoxGeometry(lungoX ? lp : wp, 0.08, lungoX ? wp : lp);
    if (lungoX) { gp.rotateX(-ang); gp.translate((x0 + x1) / 2 - L * 0.12, H + (P / 4 + sp / 2) * pend + 0.06, (z0 + z1) / 2 - (P / 4 + sp / 2)); }
    else { gp.rotateZ(ang); gp.translate((x0 + x1) / 2 - (P / 4 + sp / 2), H + (P / 4 + sp / 2) * pend + 0.06, (z0 + z1) / 2 + L * 0.1); }
    pezzo(gp, M.pannelli);
    // finestre su due piani e balconi con le fioriere verso il cortile
    const n = Math.floor(L / 3.4);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      [1.5, 4.6].forEach((y, piano) => {
        if (lungoX) {
          const x = x0 + u * L;
          finestre.push([x, y, z1 + 0.02, 1.5, piano ? 1.5 : 2.1, 0], [x, y, z0 - 0.02, 1.2, 1.3, Math.PI]);
        } else {
          const z = z0 + u * L;
          finestre.push([x0 - 0.02, y, z, 1.5, piano ? 1.5 : 2.1, -Math.PI / 2], [x1 + 0.02, y, z, 1.2, 1.3, Math.PI / 2]);
        }
      });
      if (i % 2 === 0) {
        if (lungoX) {
          const x = x0 + u * L;
          scatola(x - 1.9, 3.05, cortile, x + 1.9, 3.25, cortile + 1.4, M.soletta);
          scatola(x - 1.9, 3.25, cortile + 1.15, x + 1.9, 3.75, cortile + 1.45, M.fioriera);
        } else {
          const z = z0 + u * L;
          scatola(cortile - 1.4, 3.05, z - 1.9, cortile, 3.25, z + 1.9, M.soletta);
          scatola(cortile - 1.45, 3.25, z - 1.9, cortile - 1.15, 3.75, z + 1.9, M.fioriera);
        }
      }
    }
  };
  palazzina({ x0: -42, z0: -36, x1: -14, z1: -25, lungoX: true, cortile: -25 });
  palazzina({ x0: 28, z0: -44, x1: 39, z1: -14, lungoX: false, cortile: 28 });
  {
    const g = new THREE.PlaneGeometry(1, 1);
    const im = new THREE.InstancedMesh(g, M.vetro, finestre.length);
    const o = new THREE.Object3D();
    finestre.forEach(([x, y, z, w, h, r], i) => { o.position.set(x, y, z); o.rotation.set(0, r, 0); o.scale.set(w, h, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.visible = false;
    scena.add(im);
    pezzi.push({ obj: im, modo: 'appare', d: 48 });
  }
  // piscina comune nel giardino, con i lettini
  scatola(-6.5, 0, -40.5, 16.5, 0.14, -30.5, M.soletta, { modo: 'piano' });
  scatola(-5, 0.14, -39, 15, 0.16, -32, M.lago, { modo: 'piano' });
  for (let i = 0; i < 5; i++) scatola(-4 + i * 4, 0.14, -29.6, -2.9 + i * 4, 0.5, -27.6, M.lettino);
  // tettoie dei posti auto ai lati
  const tettoia = (x0, z0, x1, z1) => {
    scatola(x0, 2.5, z0, x1, 2.75, z1, M.tettoia, { bordi: true });
    const lungoZ = z1 - z0 > x1 - x0;
    for (let t = 0; t <= 1.0001; t += 0.25) {
      const px = lungoZ ? x0 + 0.3 : x0 + (x1 - x0) * t, pz = lungoZ ? z0 + (z1 - z0) * t : z0 + 0.3;
      scatola(px - 0.12, 0, pz - 0.12, px + 0.12, 2.5, pz + 0.12, M.palo);
    }
  };
  tettoia(-52, -46, -46, -14);
  tettoia(44, -44, 50, -10);

  // ---------- il campo da golf ----------
  const fairway = (punti, larg) => {
    for (let i = 0; i < punti.length - 1; i++) {
      const [ax, az] = punti[i], [bx, bz] = punti[i + 1];
      const L = Math.hypot(bx - ax, bz - az), a = Math.atan2(-(bz - az), bx - ax);
      ellisse((ax + bx) / 2, (az + bz) / 2, L / 2 + larg * 0.45, larg / 2, a, 0.012 + i * 0.0005, M.fairway);
    }
  };
  const bandiera = (x, z) => {
    scatola(x - 0.06, 0, z - 0.06, x + 0.06, 2.8, z + 0.06, M.palo);
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3, -0.35), new THREE.Vector2(0, -0.7)]);
    const g = new THREE.ShapeGeometry(s); g.translate(x + 0.06, 2.8, z);
    pezzo(g, M.bandiera);
  };
  const FAIR = [[[57, 11], [61, -14], [58, -40]], [[40, 39], [10, 40], [-22, 38], [-40, 39]], [[-46, -50], [-16, -48], [12, -51]]];
  fairway(FAIR[0], 13);
  ellisse(55, -50, 8, 6.5, 0.3, 0.02, M.green); bandiera(55, -50);
  ellisse(62, -34, 3.2, 2.1, 0.6, 0.025, M.sabbia); ellisse(64, -4, 2.8, 1.9, -0.4, 0.025, M.sabbia);
  fairway(FAIR[1], 11);
  ellisse(-47, 39, 6.5, 5.5, 0, 0.02, M.green); bandiera(-47, 39);
  ellisse(-37, 44.5, 3.2, 2, 0.2, 0.025, M.sabbia); ellisse(-41, 33.8, 2.8, 1.8, -0.3, 0.025, M.sabbia);
  fairway(FAIR[2], 12);
  ellisse(20, -52, 6, 5.2, 0.4, 0.02, M.green); bandiera(20, -52);
  ellisse(0, -57, 7, 3, 0.1, 0.016, M.lago); ellisse(12, -56, 2.6, 1.8, 0.5, 0.025, M.sabbia);

  // ---------- alberi (istanze: pochi disegni anche con tanti alberi) ----------
  const posti = [];
  for (let x = -40; x <= 22; x += 4.5) posti.push([x, -45 + (casuale() - 0.5) * 0.8, 'c']);       // filare di cipressi dietro, come nei render
  for (let z = -40; z <= 8; z += 5) posti.push([-30 + (casuale() - 0.5), z, 'c']);
  const libero = (x, z) => !(z > 14.5 && z < 31) && !(x > -15 && x < 20 && z > -10 && z < 17) && !(x > -45 && x < -12 && z > -38 && z < -22)
    && !(x > 25 && x < 42 && z > -46 && z < -11) && !(x > -8 && x < 18 && z > -42 && z < -26) && Math.abs(x - 47) > 5.5 && Math.abs(x + 49) > 5.5;
  let tentativi = 0;
  while (posti.length < 88 && tentativi++ < 4000) {
    const x = -58 + casuale() * 122, z = -60 + casuale() * 108;
    if (!libero(x, z)) continue;
    if (posti.some(([a, b]) => Math.hypot(a - x, b - z) < 4.2)) continue;
    const nelFairway = [...FAIR.flat(), [55, -50], [-47, 39], [20, -52], [0, -57]].some(([a, b]) => Math.hypot(a - x, b - z) < 9.5);
    if (nelFairway) continue;
    posti.push([x, z, casuale() < 0.28 ? 'c' : 't']);
  }
  [18, 30, 50].forEach(x => posti.push([x, 31, 't']));   // alberi tondi lungo il marciapiede, come nel render dall'alto
  [-30, -46].forEach(x => posti.push([x, 31, 't']));
  const cip = posti.filter(p => p[2] === 'c'), ton = posti.filter(p => p[2] === 't');
  const gCip = new THREE.ConeGeometry(0.85, 6.4, 7); gCip.translate(0, 3.6, 0);
  const gChi = new THREE.IcosahedronGeometry(1, 1); gChi.scale(1, 0.85, 1);
  const gTro = new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6); gTro.translate(0, 1.3, 0);
  const istanze = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = false; im.receiveShadow = false; im.visible = false; scena.add(im); return im; };
  const imCip = istanze(gCip, M.cipresso, cip.length), imChi = istanze(gChi, M.chioma, ton.length), imTro = istanze(gTro, M.tronco, ton.length);
  const alberi = [
    ...cip.map(([x, z], i) => ({ im: imCip, i, x, z, s: 0.85 + casuale() * 0.35, r: 1, d: Math.hypot(x - C.x, z - C.y) })),
    ...ton.map(([x, z], i) => ({ im: imChi, i, x, z, s: 1.6 + casuale() * 0.9, r: 2, d: Math.hypot(x - C.x, z - C.y) })),
  ];
  const o = new THREE.Object3D();
  const dMax = 80;

  // ---------- avanzamento del finale (rv = 0 → 1) ----------
  const esce = t => 1 - Math.pow(1 - t, 3);
  const quando = (d, rv, dur = 0.26) => Math.min(1, Math.max(0, (rv - 0.16 - 0.5 * Math.min(1, d / dMax)) / dur));
  return function avanza(rv) {
    const tb = esce(Math.min(1, rv / 0.55));
    tavola.visible = rv > 0;
    const s = 0.24 + 0.76 * tb;
    tavola.scale.set(s, 1, s);
    for (const p of pezzi) {
      const t = esce(quando(p.d, rv));
      p.obj.visible = t > 0;
      if (p.modo === 'su') p.obj.scale.set(1, Math.max(0.0001, t), 1);
      else if (p.modo === 'piano') p.obj.scale.set(Math.max(0.0001, t), 1, Math.max(0.0001, t));
      else p.obj.visible = t > 0.97;
    }
    let cambia = false;
    for (const a of alberi) {
      const t = esce(quando(a.d, rv, 0.2));
      const k = Math.max(0.0001, t) * a.s;
      o.position.set(a.x, a.r === 2 ? 2.3 + a.s * 0.8 : 0, a.z);
      o.scale.set(k, k, k);
      if (a.r === 2) o.position.y = (2.3 + a.s * 0.8) * Math.max(0.0001, t);
      o.updateMatrix();
      a.im.setMatrixAt(a.i, o.matrix);
      if (a.r === 2) {
        o.position.set(a.x, 0, a.z); o.scale.set(Math.max(0.0001, t), Math.max(0.0001, t), Math.max(0.0001, t)); o.updateMatrix();
        imTro.setMatrixAt(a.i, o.matrix);
      }
      cambia = true;
    }
    if (cambia) { imCip.instanceMatrix.needsUpdate = imChi.instanceMatrix.needsUpdate = imTro.instanceMatrix.needsUpdate = true; }
    imCip.visible = imChi.visible = imTro.visible = rv > 0.16;
  };
}
