import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback(function(id) {
    setToasts(function(prev) { return prev.map(function(t) { return t.id === id ? Object.assign({}, t, { exiting: true }) : t; }); });
    setTimeout(function() { setToasts(function(prev) { return prev.filter(function(t) { return t.id !== id; }); }); }, 250);
  }, []);

  const toast = useCallback(function(msg, type, dur) {
    if (!type) type = 'default';
    if (!dur) dur = 2600;
    const id = Math.random().toString(36).slice(2);
    setToasts(function(prev) { return prev.slice(-3).concat([{ id, msg, type }]); });
    setTimeout(function() { dismiss(id); }, dur);
  }, [dismiss]);

  const Icon = function(t) {
    if (t === 'success') return <CheckCircle size={15} style={{ color: '#30D158', flexShrink: 0 }} />;
    if (t === 'error')   return <XCircle size={15} style={{ color: '#FF453A', flexShrink: 0 }} />;
    return <Info size={15} style={{ color: '#5AC8FA', flexShrink: 0 }} />;
  };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map(function(t) {
          return (
            <div key={t.id} className={'toast' + (t.exiting ? ' exit' : '')} onClick={function() { dismiss(t.id); }}>
              {Icon(t.type)}
              {t.msg}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
