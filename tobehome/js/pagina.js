// Pagina: testi delle fasi, cronoprogramma, menu, modulo. La scena 3D si carica a parte.
const html = document.documentElement;
const ferma = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (ferma) html.classList.add('ferma');

const cantiere = document.getElementById('cantiere');
const palco = cantiere.querySelector('.palco');
const fasi = [...cantiere.querySelectorAll('.fase')];
const voci = [...cantiere.querySelectorAll('.cronoprogramma li')];
const testa = document.getElementById('testa');
const canvas = document.getElementById('scena');

let scena = null;
let pAttuale = -1;

const avanzamento = () => {
  const r = cantiere.getBoundingClientRect();
  const corsa = cantiere.offsetHeight - palco.offsetHeight;
  return corsa > 0 ? Math.min(1, Math.max(0, -r.top / corsa)) : 0;
};

const aggiorna = () => {
  testa.classList.toggle('staccata', window.scrollY > 8);
  if (ferma) return;
  const p = avanzamento();
  if (Math.abs(p - pAttuale) < 0.0002) return;
  pAttuale = p;
  fasi.forEach(f => f.classList.toggle('on', p >= +f.dataset.da && p < +f.dataset.a));
  let adesso = -1;
  voci.forEach((v, i) => { if (p >= +v.dataset.da) adesso = i; });
  voci.forEach((v, i) => { v.classList.toggle('fatto', i < adesso || p > 0.88); v.classList.toggle('adesso', i === adesso); });
  if (scena) scena.imposta(p);
};

let inAttesa = false;
window.addEventListener('scroll', () => {
  if (inAttesa) return;
  inAttesa = true;
  requestAnimationFrame(() => { inAttesa = false; aggiorna(); });
}, { passive: true });

// ridimensionamento: sul telefono si ignora la barra degli indirizzi che compare e scompare
let ultimaL = window.innerWidth, ultimaA = window.innerHeight;
window.addEventListener('resize', () => {
  const l = window.innerWidth, a = window.innerHeight;
  const soloAltezza = l === ultimaL && Math.abs(a - ultimaA) < 220 && matchMedia('(pointer: coarse)').matches;
  if (soloAltezza) return;
  ultimaL = l; ultimaA = a;
  if (scena) scena.dimensiona();
  pAttuale = -1;
  aggiorna();
});

aggiorna();

// ---------- scena 3D ----------
(async () => {
  try {
    const { avvia } = await import('./scena.js');
    scena = await avvia(canvas, { telefono: window.innerWidth < 760, ferma });
    canvas.classList.add('pronta');
    palco.classList.add('con-scena');
    pAttuale = -1;
    aggiorna();
    new IntersectionObserver(([e]) => scena.attiva(e.isIntersecting), { rootMargin: '100px' }).observe(palco);
  } catch (err) {
    console.warn('Scena 3D non disponibile:', err);
  }
})();

// ---------- modulo "Vendi casa" (nella demo non invia) ----------
const modulo = document.getElementById('modulo');
const esito = document.getElementById('esito');
const errore = (campo, testo) => {
  const box = campo.closest('.campo');
  if (box) { box.classList.toggle('sbagliato', !!testo); box.querySelector('.errore').textContent = testo || ''; }
};
const regole = {
  comune: v => v.trim().length >= 2 ? '' : 'Scrivi il comune.',
  tipo: v => v ? '' : 'Scegli il tipo di casa.',
  mq: v => !v.trim() || (/^\d{2,4}$/.test(v.trim()) && +v >= 15 && +v <= 2000) ? '' : 'Scrivi solo il numero, ad esempio 95.',
  nome: v => /^[\p{L}][\p{L}' .-]{1,40}$/u.test(v.trim()) ? '' : 'Scrivi il tuo nome.',
  cellulare: v => {
    const n = v.replace(/[\s.\-()]/g, '').replace(/^(\+39|0039)/, '');
    return /^3\d{8,9}$/.test(n) ? '' : 'Serve un cellulare italiano valido, ad esempio 333 123 4567.';
  },
};
const controlla = (el) => { const r = regole[el.name]; if (!r) return true; const t = r(el.value); errore(el, t); return !t; };
modulo.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('blur', () => { if (el.value) controlla(el); });
  el.addEventListener('input', () => { if (el.closest('.campo')?.classList.contains('sbagliato')) controlla(el); });
});
modulo.addEventListener('submit', (e) => {
  e.preventDefault();
  esito.textContent = '';
  if (modulo.sito.value) return;                       // trappola anti-robot
  let ok = true;
  modulo.querySelectorAll('input[name], select[name]').forEach(el => { if (!controlla(el)) ok = false; });
  const priv = document.getElementById('f-privacy');
  const errP = modulo.querySelector('.errore-privacy');
  errP.textContent = priv.checked ? '' : 'Serve il consenso per poterti ricontattare.';
  if (!priv.checked) ok = false;
  if (!ok) { modulo.querySelector('.sbagliato input, .sbagliato select, #f-privacy:not(:checked)')?.focus(); return; }
  esito.textContent = 'Demo: in questa bozza il modulo non invia nulla. Nel sito vero la richiesta arriva subito in agenzia.';
});

// ---------- mappa delle sedi: la si disegna quando entra, al tocco si va vicino alla sede ----------
const mappa = document.getElementById('mappa');
const tela = document.getElementById('mTela');
const svgMappa = mappa.querySelector('.m-svg');
const sopraMappa = [...tela.querySelectorAll('[data-x]')];
const mappaTelefono = matchMedia('(max-width: 760px)');
let vb = [0, 0, 1000, 790];
let scelta = -1;
const zoom = () => {
  if (scelta < 0) { tela.style.transform = ''; return; }
  const el = tela.querySelector(`.m-sede[data-sede="${scelta}"]`);
  const r = mappa.getBoundingClientRect();
  const s = 1.45;
  const px = (+el.dataset.x - vb[0]) / vb[2] * r.width, py = (+el.dataset.y - vb[1]) / vb[3] * r.height;
  const tx = Math.min(0, Math.max(r.width * (1 - s), r.width / 2 - px * s));
  const ty = Math.min(0, Math.max(r.height * (1 - s), r.height / 2 - py * s));
  tela.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
};
const piazzaMappa = () => {
  vb = mappaTelefono.matches ? [200, 60, 600, 560] : [0, 0, 1000, 790];
  svgMappa.setAttribute('viewBox', vb.join(' '));
  sopraMappa.forEach(el => {
    el.style.left = ((+el.dataset.x - vb[0]) / vb[2] * 100) + '%';
    el.style.top = ((+el.dataset.y - vb[1]) / vb[3] * 100) + '%';
  });
  zoom();
};
const seleziona = (i) => {
  scelta = scelta === i ? -1 : i;
  document.querySelectorAll('.m-sede, .scheda').forEach(el => el.classList.toggle('attiva', +el.dataset.sede === scelta));
  document.querySelectorAll('.m-sede, .scheda-testa').forEach(el => el.setAttribute('aria-pressed', String(+el.dataset.sede === scelta)));
  zoom();
};
document.querySelectorAll('.m-sede, .scheda-testa').forEach(b => b.addEventListener('click', () => seleziona(+b.dataset.sede)));
document.querySelectorAll('a.citta').forEach(a => a.addEventListener('click', () => {
  mappa.classList.add('vista');
  scelta = -1;
  setTimeout(() => seleziona(+a.dataset.sede), ferma ? 0 : 900);
}));
piazzaMappa();
mappaTelefono.addEventListener('change', piazzaMappa);
window.addEventListener('resize', zoom);
if (ferma) mappa.classList.add('vista');
else new IntersectionObserver((v, o) => { if (v[0].isIntersecting) { mappa.classList.add('vista'); o.disconnect(); } }, { threshold: 0.3 }).observe(mappa);
