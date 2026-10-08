// Pure helpers for the super_admin Session Tools page.
// Kept side-effect free (no supabase/network) so they are easy to reason about
// and reuse. Class progression relies on the canonical CLASS_OPTIONS sequence.
import { CLASS_OPTIONS, canonClass } from './classOptions';

const norm = (v) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Next canonical class for a stored class value, or null when the student is
// already in the top class (Year 12) or their class is unrecognised (held back).
export function nextClassFor(classValue) {
  const canon = canonClass(classValue);
  const idx = CLASS_OPTIONS.findIndex((c) => norm(c) === norm(canon));
  if (idx < 0 || idx >= CLASS_OPTIONS.length - 1) return null;
  return CLASS_OPTIONS[idx + 1];
}

// Parse an academic session label like "2025/2026", "2025-2026" or
// "2025 – 2026" into its two years. Returns null when no 4-digit pair is found.
export function parseSessionYears(label) {
  const m = String(label || '').match(/(\d{4})\s*[\/\-\u2013\u2014]\s*(\d{4})/);
  if (!m) return null;
  return { start: parseInt(m[1], 10), end: parseInt(m[2], 10) };
}

// Increment an academic session by one year ("2025/2026" -> "2026/2027").
// Falls back to null when the current label is not a recognisable year pair,
// so the caller can prompt for a manual value.
export function nextSessionLabel(current) {
  const y = parseSessionYears(current);
  if (!y) return null;
  return `${y.start + 1}/${y.end + 1}`;
}

// The immediately previous session, derived from an ordered session_history
// array of { session, endedAt, ... } entries (most recent push is last).
// Returns null when there is no history to step back to.
export function previousSessionFromHistory(history, current) {
  if (!Array.isArray(history) || history.length === 0) return null;
  // walk backwards for the last recorded session that differs from current
  for (let i = history.length - 1; i >= 0; i--) {
    const s = history[i]?.session;
    if (s && s !== current) return s;
  }
  return null;
}

// 6-character uppercase token mixing alphabets and digits, guaranteed to
// contain at least one letter and at least one digit.
export function generateToken(length = 6) {
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // drop I/O to avoid 1/0 confusion
  const DIGITS = '23456789'; // drop 0/1 to avoid l/0 confusion
  const ALL = LETTERS + DIGITS;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let out = '';
  for (let i = 0; i < length; i++) out += pick(ALL);
  // enforce at least one letter and one digit
  if (![...out].some((c) => LETTERS.includes(c))) {
    const at = Math.floor(Math.random() * length);
    out = out.slice(0, at) + pick(LETTERS) + out.slice(at + 1);
  }
  if (![...out].some((c) => DIGITS.includes(c))) {
    const at = Math.floor(Math.random() * length);
    out = out.slice(0, at) + pick(DIGITS) + out.slice(at + 1);
  }
  return out;
}

// Generate `count` unique tokens in one batch (avoids collisions within the set).
export function generateUniqueTokens(count) {
  const used = new Set();
  const list = [];
  for (let i = 0; i < count; i++) {
    let t = generateToken();
    let guard = 0;
    while (used.has(t) && guard++ < 200) t = generateToken();
    used.add(t);
    list.push(t);
  }
  return list;
}
