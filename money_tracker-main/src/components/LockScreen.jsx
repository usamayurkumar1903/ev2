import { useState, useEffect, useCallback } from 'react';
import { Wallet, ShieldCheck, ArrowLeft } from 'lucide-react';
import PinPad from './PinPad';
import {
  verifyPinLock, verifySecurityAnswer, resetPin,
  getSecurityQuestion, getCooldownMs,
} from '../utils/pin';

/*
 * Screens:
 *  'pin'           — normal entry screen (default)
 *  'forgot-answer' — show security question, accept text answer
 *  'forgot-newpin' — correct answer given → set new PIN
 *  'forgot-confirm'— confirm new PIN
 *
 * Security properties:
 *  - "Forgot PIN?" no longer resets the lock directly. The user must
 *    correctly answer their security question first.
 *  - Wrong PIN increments a server-persisted attempt counter; 5 failures
 *    trigger a 30-second cooldown shown with a live countdown.
 *  - Wrong security answers show an error but do NOT lock or reset anything.
 */
export default function LockScreen({ onUnlock }) {
  var screenS  = useState('pin');   var screen = screenS[0];   var setScreen = screenS[1];
  var errS     = useState('');      var error = errS[0];       var setError = errS[1];
  var resetS   = useState(0);       var rc = resetS[0];        var setRc = resetS[1];
  var cdS      = useState(0);       var cdSecs = cdS[0];       var setCdSecs = cdS[1];

  // Forgot PIN flow
  var answerS  = useState('');      var answer = answerS[0];   var setAnswer = answerS[1];
  var qaErrS   = useState('');      var qaErr = qaErrS[0];     var setQaErr = qaErrS[1];
  var pendS    = useState('');      var pendingPin = pendS[0]; var setPendingPin = pendS[1];

  // Seed cooldown timer on mount and when error changes
  var updateCd = useCallback(function () {
    var ms = getCooldownMs();
    setCdSecs(ms > 0 ? Math.ceil(ms / 1000) : 0);
  }, []);

  useEffect(function () { updateCd(); }, [updateCd]);

  useEffect(function () {
    if (cdSecs <= 0) return;
    var t = setTimeout(function () { setCdSecs(function (s) { return Math.max(0, s - 1); }); }, 1000);
    return function () { clearTimeout(t); };
  }, [cdSecs]);

  function bump() { setRc(function (c) { return c + 1; }); }

  /* ── Normal PIN entry ── */
  function handlePinComplete(pin) {
    if (cdSecs > 0) return; // ignore input during cooldown
    verifyPinLock(pin).then(function (result) {
      if (result === 'ok') { onUnlock(); return; }
      if (result === 'cooldown') {
        updateCd();
        setError('Too many attempts. Please wait.');
        bump();
        return;
      }
      setError('Incorrect PIN. Try again.');
      bump();
      setTimeout(function () { setError(''); }, 1500);
    }).catch(function () {
      setError('Something went wrong. Try again.');
      bump();
    });
  }

  /* ── Forgot PIN → security question ── */
  function handleAnswerSubmit() {
    if (!answer.trim()) { setQaErr('Please enter your answer.'); return; }
    verifySecurityAnswer(answer).then(function (ok) {
      if (!ok) {
        setQaErr('Incorrect answer. Try again.');
        setAnswer('');
        return;
      }
      setQaErr('');
      setScreen('forgot-newpin');
      setPendingPin('');
      bump();
    }).catch(function () { setQaErr('Something went wrong.'); });
  }

  /* ── New PIN after recovery ── */
  function handleNewPinComplete(pin) {
    setPendingPin(pin);
    setScreen('forgot-confirm');
    bump();
  }

  function handleConfirmPinComplete(pin) {
    if (pin !== pendingPin) {
      setQaErr("PINs didn't match. Enter the new PIN again.");
      setPendingPin('');
      setScreen('forgot-newpin');
      bump();
      return;
    }
    resetPin(pin).then(function () {
      onUnlock();
    }).catch(function () {
      setQaErr('Could not save PIN. Try again.');
      setScreen('forgot-newpin');
      bump();
    });
  }

  var question = getSecurityQuestion();

  /* ── Layout shared wrapper ── */
  function Shell({ children, back }) {
    return (
      <div className="lock-overlay">
        {back && (
          <button type="button" className="lock-back-btn" onClick={function () { setScreen('pin'); setError(''); setQaErr(''); setAnswer(''); }}>
            <ArrowLeft size={18} /> Back
          </button>
        )}
        <div className="lock-icon-wrap">
          <Wallet size={24} color="#fff" strokeWidth={2} />
        </div>
        {children}
      </div>
    );
  }

  /* ── Screens ── */

  if (screen === 'forgot-answer') {
    return (
      <Shell back>
        <div className="lock-title">Forgot PIN?</div>
        <div className="lock-subtitle">Answer your security question to reset your PIN.</div>
        {question && (
          <div className="lock-question-box">{question}</div>
        )}
        <div className="lock-answer-wrap">
          <input
            className="form-input"
            type="text"
            placeholder="Your answer"
            value={answer}
            autoComplete="off"
            onChange={function (e) { setAnswer(e.target.value); setQaErr(''); }}
          />
          {qaErr && <div className="lock-qa-error">{qaErr}</div>}
          <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={handleAnswerSubmit} type="button">
            Verify Answer
          </button>
        </div>
      </Shell>
    );
  }

  if (screen === 'forgot-newpin') {
    return (
      <Shell>
        <div className="lock-title">Set New PIN</div>
        <div className="lock-subtitle">
          {qaErr ? <span style={{ color: 'var(--danger)' }}>{qaErr}</span> : 'Choose a new 4-digit PIN'}
        </div>
        <PinPad key={'np-' + rc} length={4} onComplete={handleNewPinComplete} error={!!qaErr} />
      </Shell>
    );
  }

  if (screen === 'forgot-confirm') {
    return (
      <Shell>
        <div className="lock-title">Confirm New PIN</div>
        <div className="lock-subtitle">
          {qaErr ? <span style={{ color: 'var(--danger)' }}>{qaErr}</span> : 'Re-enter your new PIN'}
        </div>
        <PinPad key={'cp-' + rc} length={4} onComplete={handleConfirmPinComplete} error={!!qaErr} />
      </Shell>
    );
  }

  /* ── Default: PIN entry ── */
  var subtitle = cdSecs > 0
    ? 'Too many attempts. Try again in ' + cdSecs + 's.'
    : (error || 'Enter your 4-digit PIN to continue');
  var subColor = (cdSecs > 0 || error) ? { color: 'var(--danger)' } : undefined;

  return (
    <Shell>
      <div className="lock-title">Enter PIN</div>
      <div className="lock-subtitle" style={subColor}>{subtitle}</div>
      <PinPad key={rc} length={4} onComplete={handlePinComplete} error={!!(cdSecs > 0 || error)} disabled={cdSecs > 0} />
      {!cdSecs && (
        <button type="button" className="lock-forgot" onClick={function () { setScreen('forgot-answer'); setError(''); setQaErr(''); setAnswer(''); }}>
          Forgot PIN?
        </button>
      )}
    </Shell>
  );
}
