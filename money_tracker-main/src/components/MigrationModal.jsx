import { useState } from 'react';
import { CloudUpload, HardDrive, CheckCircle } from 'lucide-react';
import { migrateLocalData } from '../utils/dataService';
import { useToast } from '../hooks/useToast';

/**
 * Shown once when a user logs in for the first time and local data
 * (books / transactions) exists in localStorage.
 *
 * Choices:
 *   "Upload to cloud"  — migrate local data to Supabase, then continue.
 *   "Start fresh"      — discard local data, use whatever is in Supabase.
 *
 * After the choice is saved (et-migrated:<userId>), this modal never
 * appears again for that user.
 */
export default function MigrationModal({ userId, localBooks, localTransactions, onDone }) {
  var { toast } = useToast();
  var busyS  = useState(false); var busy = busyS[0];  var setBusy = busyS[1];
  var doneS  = useState(false); var done = doneS[0];  var setDone = doneS[1];
  var errS   = useState('');    var err = errS[0];    var setErr  = errS[1];

  async function handleUpload() {
    setBusy(true); setErr('');
    try {
      await migrateLocalData(userId, localBooks, localTransactions);
      localStorage.setItem('et-migrated:' + userId, '1');
      setDone(true);
      setTimeout(function () { onDone('uploaded'); }, 1200);
    } catch (e) {
      setErr('Migration failed: ' + (e.message || 'unknown error') + '. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  function handleFresh() {
    localStorage.setItem('et-migrated:' + userId, '1');
    onDone('fresh');
  }

  var txCount   = localTransactions.length;
  var bookCount = localBooks.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 380,
        border: '1px solid var(--border-light)', overflow: 'hidden',
        animation: 'dialog-in 220ms cubic-bezier(0.34,1.26,0.64,1) forwards',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'rgba(10,132,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <CloudUpload size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            Local data found
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 4 }}>
            You have <strong style={{ color: 'var(--text)' }}>{bookCount} book{bookCount !== 1 ? 's' : ''}</strong> and{' '}
            <strong style={{ color: 'var(--text)' }}>{txCount} transaction{txCount !== 1 ? 's' : ''}</strong> stored
            on this device. Would you like to upload them to your new account?
          </p>
        </div>

        {done && (
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <CheckCircle size={40} style={{ color: 'var(--success)' }} />
            <p style={{ fontSize: 14, color: 'var(--success)', marginTop: 8, fontWeight: 600 }}>Uploaded successfully!</p>
          </div>
        )}

        {!done && (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {err && (
              <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-dim)', borderRadius: 8, padding: '8px 12px' }}>
                {err}
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              style={{ height: 48, gap: 8, fontSize: 14, fontWeight: 700 }}
              onClick={handleUpload}
              disabled={busy}
              type="button"
            >
              <CloudUpload size={16} />
              {busy ? 'Uploading…' : 'Upload to my account'}
            </button>

            <button
              className="btn btn-full"
              style={{ height: 44, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, gap: 8 }}
              onClick={handleFresh}
              disabled={busy}
              type="button"
            >
              <HardDrive size={14} />
              Start fresh (discard local data)
            </button>

            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
              This choice only needs to be made once. Your PIN and security settings are not affected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
