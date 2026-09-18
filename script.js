/* Scrollytelling Maison Linda - logique */

/* ============================================================
   CONSTANTES RÉGLABLES
   ============================================================ */
const FRAME_COUNT = 121;        // Nombre d'images extraites
const SCROLL_LENGTH_VH = 500;   // Hauteur de défilement en vh (plus grand = plus lent)
const FIT_MODE = "contain";     // "contain" (image entière + marges) ou "cover" (plein écran)
const IMAGE_MAX_SIZE = 0.82;    // Fraction de la fenêtre occupée par l'image (marges blanches autour)
const BACKGROUND_COLOR = "#ffffff";
// Fondu blanc périphérique : le bord de l'image se confond avec le fond.
// VIGNETTE_SIZE = épaisseur du dégradé en fraction du côté de l'image (0 = désactivé).
const VIGNETTE_SIZE = 0.14;     // 14% du côté en dégradé vers le blanc
const VIGNETTE_MAX_ALPHA = 1.0; // Intensité maximale du blanc en bord d'image (0 à 1)
const FRAMES_PATH = "frames/frame_";

/* ============================================================
   RÉFÉRENCES ET ÉTAT
   ============================================================ */
const canvas = document.getElementById("frame-canvas");
const ctx = canvas.getContext("2d");
const scrollZone = document.getElementById("scroll-zone");
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderText = document.getElementById("loader-text");

const images = new Array(FRAME_COUNT);
let loadedCount = 0;
let lastDrawnIndex = -1;
let firstImageReady = false;

/* ============================================================
   DIMENSIONNEMENT DU CANVAS (Retina / dvh)
   ============================================================ */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lastDrawnIndex = -1; // force le redessin
  render();
}

/* ============================================================
   GÉOMÉTRIE DE L'IMAGE (contain / cover + marges)
   ============================================================ */
function computeDrawRect(img) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = vw * IMAGE_MAX_SIZE;
  const maxH = vh * IMAGE_MAX_SIZE;
  const scaleW = maxW / img.width;
  const scaleH = maxH / img.height;

  let scale;
  if (FIT_MODE === "cover") {
    scale = Math.max(scaleW, scaleH);
  } else {
    scale = Math.min(scaleW, scaleH);
  }

  const w = img.width * scale;
  const h = img.height * scale;
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  return { x, y, w, h };
}

/* ============================================================
   DESSIN : image + fondu blanc périphérique
   ============================================================ */
function drawFrame(index) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, vw, vh);

  // Image la plus proche déjà chargée (évite les trous blancs)
  let img = images[index];
  if (!img || !img.complete) {
    img = nearestLoadedImage(index);
  }
  if (!img) return;

  const r = computeDrawRect(img);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);

  // Dégradé blanc en périphérie de l'image
  if (VIGNETTE_SIZE > 0 && VIGNETTE_MAX_ALPHA > 0) {
    drawWhiteVignette(r);
  }

  lastDrawnIndex = index;
}

function drawWhiteVignette(r) {
  const band = Math.min(r.w, r.h) * VIGNETTE_SIZE;
  if (band <= 0) return;

  ctx.save();

  // Masque : tout l'image sauf un rectangle intérieur
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  const inner = {
    x: r.x + band,
    y: r.y + band,
    w: r.w - 2 * band,
    h: r.h - 2 * band,
  };
  ctx.rect(inner.x + inner.w, inner.y, -inner.w, inner.h); // sens inverse = trou
  ctx.clip("evenodd");

  // Dégradé blanc centré sur l'image
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(r.w, r.h) / 2);
  // Première moitié : transparente ; ensuite fondu vers blanc
  const start = 1 - 2 * VIGNETTE_SIZE;
  grad.addColorStop(Math.max(0, start), "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255," + VIGNETTE_MAX_ALPHA + ")");

  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function nearestLoadedImage(index) {
  for (let d = 0; d < FRAME_COUNT; d++) {
    const before = index - d;
    if (before >= 0 && images[before] && images[before].complete) return images[before];
    const after = index + d;
    if (after < FRAME_COUNT && images[after] && images[after].complete) return images[after];
  }
  return null;
}

/* ============================================================
   BOUCLE DE RENDU (requestAnimationFrame, redraw si index change)
   ============================================================ */
function render() {
  const doc = document.documentElement;
  const scrollable = Math.max(1, scrollZone.offsetHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
  const index = Math.round(progress * (FRAME_COUNT - 1));

  if (index !== lastDrawnIndex) {
    drawFrame(index);
  }
}

let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    render();
  });
}

/* ============================================================
   PRÉCHARGEMENT : 1ère image immédiate, puis le reste
   ============================================================ */
function loadImage(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => {
      loadedCount++;
      updateLoader();
      resolve();
    };
    img.src = FRAMES_PATH + String(i + 1).padStart(4, "0") + ".webp";
    images[i] = img;
  });
}

function updateLoader() {
  const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
  loaderBar.style.setProperty("--progress", pct + "%");
  loaderText.textContent = pct + "%";
  if (loadedCount >= FRAME_COUNT) {
    loader.classList.add("hidden");
  }
}

async function preload() {
  // Image 1 d'abord : affichée dès que possible
  await loadImage(0);
  firstImageReady = true;
  render();

  // Puis les autres, 6 par 6 pour ne pas saturer le réseau
  const CONCURRENCY = 6;
  for (let i = 1; i < FRAME_COUNT; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, FRAME_COUNT); j++) {
      batch.push(loadImage(j));
    }
    await Promise.all(batch);
    scheduleRender(); // complète les images manquantes affichées en attendant
  }
}

/* ============================================================
   INIT
   ============================================================ */
scrollZone.style.height = SCROLL_LENGTH_VH + "vh";
resizeCanvas();
preload();

window.addEventListener("scroll", scheduleRender, { passive: true });
window.addEventListener("resize", resizeCanvas);
