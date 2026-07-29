import { useState } from 'react';

/*
 * Shared 4-digit numeric keypad with masked dot indicators.
 * Props:
 *   length     – number of digits (default 4)
 *   onComplete – called with the joined digit string when full
 *   error      – bool: triggers shake animation on the dots
 *   disabled   – bool: all keys are non-interactive (used during cooldown)
 */
export default function PinPad({ length, onComplete, error, disabled }) {
  if (!length) length = 4;
  var ds = useState([]); var digits = ds[0]; var setDigits = ds[1];

  function press(d) {
    if (disabled) return;
    if (digits.length >= length) return;
    var next = digits.concat([d]);
    setDigits(next);
    if (next.length === length) {
      setTimeout(function () { onComplete(next.join('')); }, 100);
    }
  }

  function backspace() {
    if (disabled) return;
    setDigits(function (d) { return d.slice(0, -1); });
  }

  var keys = ['1','2','3','4','5','6','7','8','9','','0','back'];

  return (
    <div className={'lock-pinpad-wrap' + (disabled ? ' lock-pinpad-disabled' : '')}>
      <div className={'lock-dots' + (error ? ' shake' : '')}>
        {Array.from({ length: length }).map(function (_, i) {
          return <div key={i} className={'lock-dot' + (i < digits.length ? ' filled' : '')} />;
        })}
      </div>
      <div className="lock-keypad">
        {keys.map(function (k, i) {
          if (k === '') return <div key={i} />;
          if (k === 'back') {
            return (
              <button key={i} type="button" className="lock-key lock-key-back"
                onClick={backspace} aria-label="Backspace" disabled={disabled}>
                ⌫
              </button>
            );
          }
          return (
            <button key={i} type="button" className="lock-key"
              onClick={function () { press(k); }} disabled={disabled}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
