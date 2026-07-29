import { useState, useEffect } from 'react';
import { X, ShieldCheck, ArrowLeft } from 'lucide-react';
import PinPad from './PinPad';
import Portal from './Portal';
import { useToast } from '../hooks/useToast';
import {
  setPinLock, verifyPinLock, resetPin, disablePinLock,
  SECURITY_QUESTIONS,
} from '../utils/pin';

/*
 * Full-screen modal — mirrors lock-overlay exactly so the keypad
 * is always fully visible and vertically centred on every device.
 * Back / Close buttons are absolutely positioned at the top corners
 * so they never consume vertical space and break the centring.
 *
 * mode:
 *  'create'  → new PIN → confirm → security question → enabled
 *  'change'  → current PIN → new PIN → confirm        (keeps QA)
 *  'disable' → current PIN → lock off
 */
export default function PinSetupModal({ open, onClose, mode, onSuccess }) {
  var toast  = useToast().toast;
  var stepS  = useState('new');  var step = stepS[0];        var setStep       = stepS[1];
  var pendS  = useState('');     var pendingPin = pendS[0];  var setPendingPin  = pendS[1];
  var errS   = useState('');     var error = errS[0];        var setError       = errS[1];
  var rcS    = useState(0);      var rc = rcS[0];            var setRc          = rcS[1];

  // Security question (create mode → question step)
  var qIdxS    = useState(0);  var qIdx    = qIdxS[0];    var setQIdx    = qIdxS[1];
  var customQS = useState(''); var customQ = customQS[0]; var setCustomQ = customQS[1];
  var answerS  = useState(''); var answer  = answerS[0];  var setAnswer  = answerS[1];
  var qaErrS   = useState(''); var qaErr   = qaErrS[0];   var setQaErr   = qaErrS[1];

  useEffect(function () {
    if (!open) return;
    setError(''); setQaErr('');
    setPendingPin(''); setAnswer(''); setCustomQ(''); setQIdx(0);
    setStep(mode === 'create' ? 'new' : 'current');
    setRc(function (c) { return c + 1; });
  }, [open, mode]);

  if (!open) return null;

  function bump() { setRc(function (c) { return c + 1; }); }

  /* ── PIN handlers ── */
  function handleCurrentComplete(pin) {
    verifyPinLock(pin).then(function (result) {
      if (result === 'cooldown') { setError('Too many attempts. Wait 30 s.'); bump(); return; }
      if (result !== 'ok')       { setError('Incorrect PIN');                  bump(); return; }
      if (mode === 'disable') {
        disablePinLock();
        toast('App Lock disabled', 'success');
        if (onSuccess) onSuccess();
        onClose();
        return;
      }
      setError(''); setStep('new'); bump();
    }).catch(function () { setError('Something went wrong'); bump(); });
  }

  function handleNewComplete(pin) {
    setPendingPin(pin); setError(''); setStep('confirm'); bump();
  }

  function handleConfirmComplete(pin) {
    if (pin !== pendingPin) {
      setError("PINs didn't match. Try again.");
      setPendingPin(''); setStep('new'); bump();
      return;
    }
    if (mode === 'change') {
      resetPin(pin).then(function () {
        toast('PIN changed', 'success');
        if (onSuccess) onSuccess();
        onClose();
      }).catch(function () { toast('Could not save PIN', 'error'); });
      return;
    }
    // create mode → security question
    setError(''); setStep('question');
  }

  /* ── Security question submit ── */
  function handleQASubmit() {
    var q = qIdx === SECURITY_QUESTIONS.length - 1
      ? customQ.trim()
      : SECURITY_QUESTIONS[qIdx];
    if (!q)             { setQaErr('Enter a security question.'); return; }
    if (!answer.trim()) { setQaErr('Enter a security answer.');   return; }
    setPinLock(pendingPin, q, answer).then(function () {
      toast('App Lock enabled', 'success');
      if (onSuccess) onSuccess();
      onClose();
    }).catch(function () { toast('Could not save PIN', 'error'); });
  }

  function handleBack() {
    setError(''); setQaErr('');
    if (step === 'confirm')  { setPendingPin(''); setStep('new');     bump(); }
    else if (step === 'question') {             setStep('confirm'); bump(); }
  }

  var canGoBack = step === 'confirm' || step === 'question';
  var isCustomQ = qIdx === SECURITY_QUESTIONS.length - 1;

  var titles = {
    current : mode === 'disable' ? 'Disable App Lock' : 'Enter Current PIN',
    new     : 'Set New PIN',
    confirm : 'Confirm New PIN',
    question: 'Security Question',
  };
  var subs = {
    current : mode === 'disable'
      ? 'Enter your current PIN to turn off App Lock'
      : 'Enter your current PIN to continue',
    new     : 'Choose a 4-digit PIN',
    confirm : 'Re-enter your PIN to confirm',
    question: 'Used to recover access if you forget your PIN',
  };

  var onPinComplete = step === 'current' ? handleCurrentComplete
    : step === 'new'  ? handleNewComplete
    : handleConfirmComplete;

  /* ────────────────────────────────────────────────────────────────
   * Render — single centred column, exactly like LockScreen.
   * Nav buttons are absolute so they never affect vertical layout.
   * ────────────────────────────────────────────────────────────── */
  return (
    <Portal>
    <div className="pin-fs-overlay">

      {/* Absolute navigation ── top corners */}
      {canGoBack && (
        <button type="button" className="pin-fs-nav-btn pin-fs-back-btn" onClick={handleBack}>
          <ArrowLeft size={18} />
        </button>
      )}
      <button type="button" className="pin-fs-nav-btn pin-fs-close-btn" onClick={onClose}>
        <X size={18} />
      </button>

      {/* ── PIN entry steps ── */}
      {step !== 'question' && (
        <>
          <div className="lock-icon-wrap" style={{ background: 'var(--accent)', marginBottom: 10 }}>
            <ShieldCheck size={22} color="#fff" strokeWidth={2} />
          </div>
          <div className="lock-title">{titles[step]}</div>
          <div className="lock-subtitle" style={error ? { color: 'var(--danger)' } : undefined}>
            {error || subs[step]}
          </div>
          <PinPad key={rc} length={4} onComplete={onPinComplete} error={!!error} />
        </>
      )}

      {/* ── Security question step ── */}
      {step === 'question' && (
        <div className="pin-fs-qa-inner">
          <div className="lock-icon-wrap" style={{ background: 'var(--accent)', marginBottom: 10 }}>
            <ShieldCheck size={22} color="#fff" strokeWidth={2} />
          </div>
          <div className="lock-title">{titles.question}</div>
          <p className="lock-subtitle">{subs.question}</p>

          <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
            <label className="form-label">Security Question</label>
            <select
              className="form-input"
              value={qIdx}
              onChange={function (e) { setQIdx(Number(e.target.value)); setQaErr(''); }}
            >
              {SECURITY_QUESTIONS.map(function (q, i) {
                return <option key={i} value={i}>{q}</option>;
              })}
            </select>
          </div>

          {isCustomQ && (
            <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
              <label className="form-label">Your Question</label>
              <input
                className="form-input"
                type="text"
                placeholder="Type your custom question"
                value={customQ}
                onChange={function (e) { setCustomQ(e.target.value); setQaErr(''); }}
              />
            </div>
          )}

          <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
            <label className="form-label">Answer</label>
            <input
              className="form-input"
              type="text"
              placeholder="Your answer (case-insensitive)"
              value={answer}
              onChange={function (e) { setAnswer(e.target.value); setQaErr(''); }}
              autoComplete="off"
            />
            <div className="form-hint">Not case-sensitive. Ignores leading/trailing spaces.</div>
          </div>

          {qaErr && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10, textAlign: 'center' }}>
              {qaErr}
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            style={{ height: 48, marginTop: 4 }}
            onClick={handleQASubmit}
            type="button"
          >
            Enable App Lock
          </button>
        </div>
      )}

    </div>
    </Portal>
  );
}
