// Per-photo passport framing for the ID cards.
//
// Why this exists: a single global background-size/background-position cannot
// frame every subject. Two independent reasons:
//
//   1. `background-size: 150%` scales the image by WIDTH only, so the drawn
//      height follows each photo's own aspect ratio. Whenever that height is
//      not taller than the frame there is nothing to pan, and a vertical
//      `background-position` becomes a mathematical no-op.
//   2. Even with overflow to pan, students differ in height, camera distance
//      and headroom, so the anchor has to come from each photo.
//
// So the crop is computed from the image's intrinsic dimensions (an explicit
// object-fit:cover, which always fills the frame and always has overflow to
// position) and anchored on a detected face position that is stored per row.
// Everything is expressed in millimetres of physical card, so the on-screen
// preview, the scaled grid thumbnail and the html2canvas PDF export agree.

// Passport window on the CR-80 card face.
export const FRAME_W_MM = 22;
export const FRAME_H_MM = 24;

// Where the face sits inside that window: 56% down leaves clear headroom above
// the crown and chin/shoulders below, which is the "head down to shoulder
// level" crop. Raise this to move every face further down the window.
const FACE_ANCHOR_Y = 0.56;
const FACE_ANCHOR_X = 0.5;

// Safety limits so a bad detection can never blank the frame.
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 1.6;

// Used until a photo has been analysed: aspect-correct cover plus a mild zoom
// biased toward the top of the frame, where a passport subject's head is.
export const DEFAULT_FRAME = { z: 1.15, fx: 0.5, fy: 0.33 };

// Placeholder rendered when a record has no photo at all.
export const PLACEHOLDER_URL = "/logo.png";

// MediaPipe assets are fetched on demand only — nothing here is loaded at
// page load or shipped in the initial bundle. The dynamic import() must use a
// literal specifier so the bundler can see it.
const MPIPE_VERSION = "1.1.1";
const MPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MPIPE_VERSION}/wasm`;
const MPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// Analysis is done on a small copy: fast, and far below the original size so
// decode cost stays trivial even for a few hundred students.
const ANALYSIS_MAX_PX = 256;
const DETECT_TIMEOUT_MS = 10000;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Fraction-based sanity: keep the anchor inside the photo and the zoom inside
// the range where shoulders are still visible.
function normalizeFrame(f) {
  if (!f) return null;
  const fx = Number(f.fx);
  const fy = Number(f.fy);
  const z = Number(f.z);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  return {
    fx: clamp(fx, 0, 1),
    fy: clamp(fy, 0, 1),
    z: Number.isFinite(z) ? clamp(z, MIN_ZOOM, MAX_ZOOM) : DEFAULT_FRAME.z,
  };
}

// object-fit:cover drawn size for this photo, then the extra zoom.
function coverSize(iw, ih, fw = FRAME_W_MM, fh = FRAME_H_MM) {
  const k = Math.max(fw / iw, fh / ih);
  return { iw, ih, k, dw: iw * k, dh: ih * k };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// Resolve a frame descriptor (stored or default) into an mm box that always
// covers the window. Returns null when the photo size is not known yet.
export function computeBox(iw, ih, frame) {
  if (!Number.isFinite(iw) || !Number.isFinite(ih) || iw <= 0 || ih <= 0) return null;
  const f = normalizeFrame(frame) || DEFAULT_FRAME;
  const { dw, dh } = coverSize(iw, ih);
  const zw = dw * f.z;
  const zh = dh * f.z;
  const left = FRAME_W_MM * FACE_ANCHOR_X - f.fx * zw;
  const top = FRAME_H_MM * FACE_ANCHOR_Y - f.fy * zh;
  return {
    dw: round3(zw),
    dh: round3(zh),
    // clamped so the photo always covers the window: no white edge, no gap
    left: round3(clamp(left, FRAME_W_MM - zw, 0)),
    top: round3(clamp(top, FRAME_H_MM - zh, 0)),
  };
}

const round3 = (n) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// Stored jsonb
// ---------------------------------------------------------------------------

// Parse the passport_frame column defensively — never trust DB contents.
export function loadFrameJson(value) {
  if (!value) return null;
  let obj = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const base = normalizeFrame(obj);
  if (!base) return null;
  return { ...base, src: obj.src || null, iw: Number(obj.iw) || null, ih: Number(obj.ih) || null, by: obj.by || "ml" };
}

// A stored frame only applies to the exact photo it was computed from, so a
// re-uploaded passport is re-framed automatically.
export function isFrameFresh(stored, srcValue) {
  return !!stored && stored.src === (srcValue || "");
}

// ---------------------------------------------------------------------------
// Image loading (cached)
// ---------------------------------------------------------------------------

const intrinsicCache = new Map(); // url -> { iw, ih }
const analysisCache = new Map(); // url -> { canvas, iw, ih } | null (null = failed)

// Sync peek at an already-decoded size, so a re-render never waits a tick.
export function peekIntrinsic(url) {
  return (url && intrinsicCache.get(url)) || null;
}

// Plain decode, no pixel access, so a cross-origin photo cannot taint anything.
export function readIntrinsic(url) {
  if (!url) return Promise.resolve(null);
  if (intrinsicCache.has(url)) return Promise.resolve(intrinsicCache.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dims = { iw: img.naturalWidth, ih: img.naturalHeight };
      intrinsicCache.set(url, dims);
      resolve(dims);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// crossOrigin must be set before src for the pixel copy to be readable. Supabase
// storage serves CORS headers (the PDF export already relies on useCORS), but a
// bucket without them just yields null and the default framing still works.
function loadAnalysisCanvas(url) {
  if (analysisCache.has(url)) return Promise.resolve(analysisCache.get(url));
  const job = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, ANALYSIS_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        ctx.getImageData(0, 0, 1, 1); // throws now if the canvas is tainted
        const out = { canvas, iw: img.naturalWidth, ih: img.naturalHeight };
        intrinsicCache.set(url, { iw: img.naturalWidth, ih: img.naturalHeight });
        resolve(out);
      } catch {
        resolve(null); // tainted or unreadable — caller falls back
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  analysisCache.set(url, job);
  return job;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// Tier 1: face detection
// ---------------------------------------------------------------------------

// One detector instance per session: the wasm runtime and model are heavy, so
// they are created on the first analysis and reused by every later photo.
async function getDetector() {
  const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
  if (!getDetector.instance) {
    const fileset = await FilesetResolver.forVisionTasks(MPIPE_WASM);
    getDetector.instance = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MPIPE_MODEL },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });
  }
  return getDetector.instance;
}

// BlazeFace gives a box in analysis-canvas pixels; fractions of the photo are
// what the renderer needs, so the downscale factor cancels out.
async function detectByFace(url) {
  const source = await loadAnalysisCanvas(url);
  if (!source) return null;
  const { canvas } = source;
  const detections = (await getDetector()).detect(canvas);
  const det = detections && detections.detections && detections.detections[0];
  const box = det && det.boundingBox;
  if (!box) return null;
  const fy = clamp((box.originY + box.height / 2) / canvas.height, 0, 1);
  const fx = clamp((box.originX + box.width / 2) / canvas.width, 0, 1);
  // Zoom until the head fills ~55% of the window height; clamped so shoulders
  // stay in shot even when the detector reports a very small box.
  const faceHf = clamp(box.height / canvas.height, 0.02, 1);
  const headMmAtCover = faceHf * coverSize(source.iw, source.ih).dh;
  const z = clamp((0.55 * FRAME_H_MM) / headMmAtCover, MIN_ZOOM, MAX_ZOOM);
  return { fx, fy, z };
}

// ---------------------------------------------------------------------------
// Tier 2: subject-band heuristic (no download, works offline)
// ---------------------------------------------------------------------------

// Per-row luminance change: the head is the strongest horizontal feature band
// in the upper two thirds, and its vertical centre is a usable anchor.
function detectByProfile(url) {
  return loadAnalysisCanvas(url).then((source) => {
    if (!source) return null;
    const { canvas } = source;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let data;
    try {
      data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch {
      return null;
    }
    const { width, height } = canvas;
    const lum = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const rowVar = new Float32Array(height);
    const rowEdge = new Float32Array(height);
    const limit = Math.floor(height * 0.7); // search the top two thirds
    for (let y = 1; y < height; y++) {
      let mean = 0;
      for (let x = 0; x < width; x++) mean += lum[y * width + x];
      mean /= width;
      let v = 0;
      let e = 0;
      for (let x = 0; x < width; x++) {
        const d = lum[y * width + x] - mean;
        v += d * d;
        if (x > 0) e += Math.abs(lum[y * width + x] - lum[y * width + x - 1]);
      }
      rowVar[y] = v / width;
      rowEdge[y] = e / width;
    }
    let best = 0;
    let bestY = -1;
    for (let y = 1; y < limit; y++) {
      const score = rowVar[y] + rowEdge[y] * 6;
      if (score > best) {
        best = score;
        bestY = y;
      }
    }
    if (bestY < 0 || best <= 0) return null;
    return { fx: 0.5, fy: clamp(bestY / height, 0, 1), z: DEFAULT_FRAME.z };
  });
}

// ---------------------------------------------------------------------------
// Public detection entry
// ---------------------------------------------------------------------------

// Never throws and never hangs the queue: on any failure the caller still gets
// a usable frame (the default), just tagged so it can be retried later.
export async function detectFrame(url, srcValue) {
  const fallback = { ...DEFAULT_FRAME, src: srcValue || "", by: "default" };
  let anchor = null;
  let by = "default";
  try {
    anchor = await withTimeout(detectByFace(url), DETECT_TIMEOUT_MS);
    if (anchor) by = "ml";
  } catch {
    anchor = null;
  }
  if (!anchor) {
    try {
      anchor = await withTimeout(detectByProfile(url), DETECT_TIMEOUT_MS);
      if (anchor) by = "heur";
    } catch {
      anchor = null;
    }
  }
  const dims = await readIntrinsic(url);
  const base = normalizeFrame(anchor) || DEFAULT_FRAME;
  return {
    json: {
      v: 1,
      src: srcValue || "",
      iw: dims ? dims.iw : 0,
      ih: dims ? dims.ih : 0,
      z: round3(base.z),
      fx: round3(base.fx),
      fy: round3(base.fy),
      by,
    },
    frame: { ...base, iw: dims ? dims.iw : null, ih: dims ? dims.ih : null },
  };
}
