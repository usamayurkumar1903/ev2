/*
 * App Lock — PIN + Security Question helper.
 *
 * Storage key: 'et-pin-lock'  (separate from financial data in 'et-v2')
 *
 * State shape stored in localStorage:
 * {
 *   enabled      : bool,
 *   pinSalt      : hex,          // random salt for PIN hash
 *   pinHash      : hex,          // SHA-256(pinSalt + ':' + pin)
 *   qSalt        : hex,          // random salt for security-answer hash
 *   qHash        : hex,          // SHA-256(qSalt + ':' + normalise(answer))
 *   question     : string,       // stored in plain text (not sensitive)
 *   attempts     : number,       // consecutive wrong-PIN attempts
 *   cooldownUntil: number|null,  // epoch-ms when cooldown expires
 * }
 *
 * Security properties:
 *  - PIN never stored in plain text — only a salted SHA-256 hash.
 *  - Security answer never stored in plain text — same approach.
 *  - Answers are normalised (trimmed + lowercased) before hashing so
 *    comparison is case-insensitive and space-insensitive.
 *  - After 5 consecutive wrong PIN entries a 30-second cooldown is applied.
 *    Cooldown is persisted so refreshing the page does not reset it.
 *  - Resetting via "Forgot PIN" requires correct security answer; the app
 *    cannot be unlocked without either the PIN or the security answer.
 *  - Financial data and attachments are never touched by any PIN operation.
 */

var PIN_KEY = 'et-pin-lock';
var MAX_ATTEMPTS = 5;
var COOLDOWN_MS  = 30 * 1000; // 30 seconds

/* ── Crypto helpers ─────────────────────────────────────────────── */

function bufToHex(buf) {
  var bytes = new Uint8Array(buf);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function randomSaltHex() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes);
}

function sha256Hex(text) {
  var data = new TextEncoder().encode(text);
  return crypto.subtle.digest('SHA-256', data).then(bufToHex);
}

/** Trim and lowercase so answer comparison is case/space insensitive. */
function normaliseAnswer(raw) {
  return String(raw || '').trim().toLowerCase();
}

/* ── State persistence ──────────────────────────────────────────── */

function defaultState() {
  return {
    enabled: false,
    pinSalt: null, pinHash: null,
    qSalt: null, qHash: null, question: null,
    attempts: 0, cooldownUntil: null,
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(PIN_KEY);
    if (!raw) return defaultState();
    var p = JSON.parse(raw);
    return Object.assign(defaultState(), p);
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  try { localStorage.setItem(PIN_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ── Public API ─────────────────────────────────────────────────── */

/** Whether App Lock is currently turned on. */
export function isPinLockEnabled() {
  return loadState().enabled;
}

/** Return the stored security question string, or null if none set. */
export function getSecurityQuestion() {
  return loadState().question || null;
}

/**
 * Set (or replace) the PIN and security Q&A together.
 * Called on first enable and when changing the PIN.
 * question  : plain-text question string
 * answerRaw : raw answer string (will be normalised before hashing)
 */
export function setPinLock(pin, question, answerRaw) {
  var pinSalt = randomSaltHex();
  var qSalt   = randomSaltHex();
  var existing = loadState();
  return Promise.all([
    sha256Hex(pinSalt + ':' + pin),
    sha256Hex(qSalt   + ':' + normaliseAnswer(answerRaw)),
  ]).then(function (results) {
    saveState({
      enabled      : true,
      pinSalt      : pinSalt,
      pinHash      : results[0],
      qSalt        : qSalt,
      qHash        : results[1],
      question     : question,
      attempts     : 0,
      cooldownUntil: null,
    });
    return true;
  });
}

/**
 * Replace only the PIN hash (used after "Forgot PIN" recovery).
 * Security QA is preserved — user already proved identity to get here.
 */
export function resetPin(newPin) {
  var state = loadState();
  var pinSalt = randomSaltHex();
  return sha256Hex(pinSalt + ':' + newPin).then(function (pinHash) {
    saveState(Object.assign({}, state, {
      pinSalt: pinSalt,
      pinHash: pinHash,
      attempts: 0,
      cooldownUntil: null,
    }));
    return true;
  });
}

/**
 * Verify an entered PIN.
 * Returns Promise<'ok' | 'wrong' | 'cooldown'>
 * Tracks consecutive failures; applies cooldown after MAX_ATTEMPTS.
 */
export function verifyPinLock(pin) {
  var state = loadState();
  if (!state.enabled || !state.pinSalt || !state.pinHash) {
    return Promise.resolve('wrong');
  }
  // Check cooldown first
  if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
    return Promise.resolve('cooldown');
  }
  return sha256Hex(state.pinSalt + ':' + pin).then(function (hash) {
    if (hash === state.pinHash) {
      // Correct — reset attempt counter
      saveState(Object.assign({}, state, { attempts: 0, cooldownUntil: null }));
      return 'ok';
    }
    // Wrong — increment counter, maybe start cooldown
    var attempts = (state.attempts || 0) + 1;
    var cooldownUntil = attempts >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : null;
    saveState(Object.assign({}, state, { attempts: attempts, cooldownUntil: cooldownUntil }));
    return attempts >= MAX_ATTEMPTS ? 'cooldown' : 'wrong';
  });
}

/**
 * Verify the security answer.
 * Returns Promise<bool>  (no attempt tracking — answer is only shown after
 * the user explicitly taps "Forgot PIN?", so brute-forcing it is already
 * gated behind physical access to the device).
 */
export function verifySecurityAnswer(answerRaw) {
  var state = loadState();
  if (!state.qSalt || !state.qHash) return Promise.resolve(false);
  return sha256Hex(state.qSalt + ':' + normaliseAnswer(answerRaw)).then(function (hash) {
    return hash === state.qHash;
  });
}

/**
 * Remaining cooldown in milliseconds (0 if none).
 */
export function getCooldownMs() {
  var state = loadState();
  if (!state.cooldownUntil) return 0;
  return Math.max(0, state.cooldownUntil - Date.now());
}

/** Turn App Lock off and forget the stored PIN. Financial data is untouched. */
export function disablePinLock() {
  saveState(defaultState());
}

/** Predefined security questions the user can choose from. */
export var SECURITY_QUESTIONS = [
  'What is your favorite color?',
  'What was the name of your first pet?',
  'What is your favorite food?',
  'What is your favorite movie?',
  'What city were you born in?',
  'What is your mother\'s maiden name?',
  'Custom question…',
];
