import { useState } from 'react';
import { X, Download, Upload, ShieldCheck, AlertTriangle, GitMerge, RefreshCw, LogIn } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import Portal from './Portal';
import {
  getAllAttachments, clearAllAttachments,
  restoreAttachments, mergeAttachments,
} from '../utils/db';

var BACKUP_VERSION = 2; // v2 includes owner binding
var APP_DATA_KEY   = 'et-v2';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl, mime) {
  var arr = dataUrl.split(','), bin = atob(arr[1]);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadJson(jsonStr, filename) {
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

function smartMerge(current, backup) {
  var result = JSON.parse(JSON.stringify(current));
  var bookIds = {};
  (result.books || []).forEach(function (b) { bookIds[b.id] = true; });
  (backup.books || []).forEach(function (b) {
    if (!bookIds[b.id]) { result.books.push(b); bookIds[b.id] = true; }
  });
  var txMap = {};
  (result.transactions || []).forEach(function (t) { txMap[t.id] = t; });
  (backup.transactions || []).forEach(function (t) {
    if (!txMap[t.id]) {
      result.transactions.push(t); txMap[t.id] = t;
    } else {
      var localTs = txMap[t.id].updatedAt || 0, backupTs = t.updatedAt || 0;
      if (backupTs > localTs) {
        var idx = result.transactions.findIndex(function (tx) { return tx.id === t.id; });
        if (idx >= 0) result.transactions[idx] = t;
        txMap[t.id] = t;
      }
    }
  });
  if (backup.settings) {
    if (!result.settings) result.settings = {};
    Object.keys(backup.settings).forEach(function (k) {
      if (result.settings[k] === undefined) result.settings[k] = backup.settings[k];
    });
  }
  return result;
}

export default function BackupRestoreModal({ open, onClose, userId, userEmail }) {
  var toast = useToast().toast;
  var isGuest = !userId;

  var tabS     = useState('backup'); var tab = tabS[0];         var setTab     = tabS[1];
  var busyS    = useState(false);    var busy = busyS[0];       var setBusy    = busyS[1];
  var previewS = useState(null);     var preview = previewS[0]; var setPreview = previewS[1];
  var rawDataS = useState(null);     var rawData = rawDataS[0]; var setRawData = rawDataS[1];
  var confS    = useState('none');   var confMode = confS[0];   var setConfMode= confS[1];
  var errS     = useState('');       var restErr = errS[0];     var setRestErr = errS[1];

  if (!open) return null;

  function switchTab(t) {
    setTab(t); setRestErr(''); setPreview(null); setRawData(null); setConfMode('none');
  }

  /* ── Guest wall ── */
  function GuestWall() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LogIn size={24} style={{ color: 'var(--accent-light)' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>Sign in required</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 280 }}>
          Please sign in to download or restore backup files. Backup is available for signed-in accounts only to ensure your data is securely linked to your identity.
        </div>
      </div>
    );
  }

  /* ── BACKUP ── */
  function handleBackup() {
    setBusy(true);
    var appRaw = localStorage.getItem(APP_DATA_KEY);
    var appJson = appRaw ? JSON.parse(appRaw) : {};
    getAllAttachments().then(function (records) {
      var jobs = records.map(function (rec) {
        if (!rec.blob) return Promise.resolve(null);
        return blobToBase64(rec.blob).then(function (b64) {
          return { txId: rec.txId, mime: rec.mime, name: rec.name, updatedAt: rec.updatedAt, data: b64 };
        });
      });
      return Promise.all(jobs).then(function (atts) {
        var backup = {
          version   : BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          // ── Account binding: tie backup to the creating user ──
          ownerId   : userId,
          ownerEmail: userEmail || null,
          appData   : appJson,
          attachments: atts.filter(Boolean),
        };
        downloadJson(JSON.stringify(backup, null, 2), 'money-tracker-backup-' + todayStr() + '.json');
        toast('Backup downloaded', 'success');
      });
    }).catch(function () { toast('Backup failed. Try again.', 'error'); })
      .finally(function () { setBusy(false); });
  }

  /* ── FILE SELECT ── */
  function handleFileChange(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.json')) { setRestErr('Please select a .json backup file.'); return; }
    setRestErr(''); setPreview(null); setRawData(null); setConfMode('none');
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed.version || !parsed.exportedAt || !parsed.appData) {
          setRestErr('This file does not look like a valid backup.'); return;
        }

        // ── Account binding check ──
        // Every backup created by this app (v2+) carries the creator's
        // userId. We block restore whenever the backup's owner does not
        // exactly match the currently signed-in user. This also covers
        // backups with NO ownerId at all (e.g. tampered/old files) when
        // the current user IS signed in — those can't be verified safe,
        // so we refuse rather than risk mixing another account's data.
        var backupOwner  = parsed.ownerId ? String(parsed.ownerId).trim() : null;
        var currentOwner = userId ? String(userId).trim() : null;

        if (currentOwner && backupOwner && backupOwner !== currentOwner) {
          setRestErr(
            'This backup was created from a different account (' +
            (parsed.ownerEmail || backupOwner.slice(0, 8) + '…') +
            ') and cannot be restored while signed in as ' + (userEmail || 'this account') +
            '. Please sign in with the original account to restore this backup.'
          );
          return;
        }
        if (currentOwner && !backupOwner) {
          setRestErr(
            'This backup file has no account information and cannot be verified. ' +
            'For your safety, only backups created by your own signed-in account can be restored.'
          );
          return;
        }

        var cur = localStorage.getItem(APP_DATA_KEY);
        var cur2 = cur ? JSON.parse(cur) : { books: [], transactions: [] };
        var bIds = new Set((parsed.appData.transactions || []).map(function (t) { return t.id; }));
        var lIds = new Set((cur2.transactions || []).map(function (t) { return t.id; }));
        var newCount = 0; bIds.forEach(function (id) { if (!lIds.has(id)) newCount++; });
        setPreview({
          exportedAt  : new Date(parsed.exportedAt).toLocaleString(),
          books       : (parsed.appData.books || []).length,
          transactions: (parsed.appData.transactions || []).length,
          attachments : (parsed.attachments || []).length,
          newTxCount  : newCount,
          ownerEmail  : parsed.ownerEmail || null,
        });
        setRawData(parsed);
      } catch (e2) { setRestErr('Could not read the file. Is it a valid backup?'); }
    };
    reader.onerror = function () { setRestErr('Could not read the file.'); };
    reader.readAsText(file);
  }

  /* ── SMART MERGE ── */
  function handleMergeRestore() {
    if (!rawData) return;
    setBusy(true); setConfMode('none');
    var cur = localStorage.getItem(APP_DATA_KEY);
    var cur2 = cur ? JSON.parse(cur) : { books: [], transactions: [], settings: {} };
    var merged = smartMerge(cur2, rawData.appData);
    try { localStorage.setItem(APP_DATA_KEY, JSON.stringify(merged)); }
    catch (e) { toast('Merge failed: could not write data.', 'error'); setBusy(false); return; }
    var recs = (rawData.attachments || []).map(function (a) {
      try { return { txId: a.txId, blob: base64ToBlob(a.data, a.mime), mime: a.mime, name: a.name, updatedAt: a.updatedAt }; }
      catch (e) { return null; }
    }).filter(Boolean);
    mergeAttachments(recs).then(function () {
      toast('Backup merged! Reloading…', 'success');
      setTimeout(function () { window.location.reload(); }, 900);
    }).catch(function () {
      toast('Data merged (some attachments skipped). Reloading…', 'success');
      setTimeout(function () { window.location.reload(); }, 900);
    });
  }

  /* ── REPLACE ALL ── */
  function handleReplaceRestore() {
    if (!rawData) return;
    setBusy(true); setConfMode('none');
    clearAllAttachments().catch(function () {}).then(function () {
      try { localStorage.setItem(APP_DATA_KEY, JSON.stringify(rawData.appData)); }
      catch (e) { toast('Restore failed.', 'error'); setBusy(false); return; }
      var recs = (rawData.attachments || []).map(function (a) {
        try { return { txId: a.txId, blob: base64ToBlob(a.data, a.mime), mime: a.mime, name: a.name, updatedAt: a.updatedAt }; }
        catch (e) { return null; }
      }).filter(Boolean);
      return restoreAttachments(recs);
    }).then(function () {
      toast('All data replaced. Reloading…', 'success');
      setTimeout(function () { window.location.reload(); }, 900);
    }).catch(function () {
      toast('Restore failed. Your data may be unchanged.', 'error'); setBusy(false);
    });
  }

  var row = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--border)' };
  var lbl = { fontSize:13, color:'var(--text-3)' };
  var val = { fontSize:13, fontWeight:600, color:'var(--text)' };

  return (
    <Portal>
    <div className="td-overlay" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className="br-card">
        <div className="br-header">
          <span className="br-title">Backup &amp; Restore</span>
          <button className="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        <div className="br-tabs">
          {['backup','restore'].map(function (t) {
            return (
              <button key={t} type="button" className={'br-tab' + (tab === t ? ' active' : '')}
                onClick={function () { switchTab(t); }}>
                {t === 'backup' ? 'Create Backup' : 'Restore Backup'}
              </button>
            );
          })}
        </div>

        <div className="br-body">
          {/* Guest wall — same for both tabs */}
          {isGuest && <GuestWall />}

          {/* BACKUP tab */}
          {!isGuest && tab === 'backup' && (
            <div className="br-section">
              <div className="br-info-box">
                Creates a single <strong>.json</strong> file with all your books, transactions, settings, and receipt attachments. The backup is securely linked to your account.
              </div>
              <div className="br-notice br-notice-green">
                <ShieldCheck size={14} style={{ color:'var(--success)', flexShrink:0, marginTop:1 }} />
                <span><strong>Account-bound backup</strong> — this backup can only be restored while signed in as <strong>{userEmail || 'your account'}</strong>. PIN settings are not included.</span>
              </div>
              <button className="btn btn-primary btn-full br-action-btn"
                onClick={handleBackup} disabled={busy} type="button">
                <Download size={15} />
                {busy ? 'Preparing…' : 'Download Backup File'}
              </button>
            </div>
          )}

          {/* RESTORE tab */}
          {!isGuest && tab === 'restore' && (
            <div className="br-section">
              <div className="br-notice br-notice-green">
                <GitMerge size={14} style={{ color:'var(--success)', flexShrink:0, marginTop:1 }} />
                <span><strong>Smart Merge (default):</strong> merges backup with your existing data. Existing transactions remain intact. Missing records are restored. No data is deleted.</span>
              </div>

              {confMode === 'none' && (
                <label className="br-file-btn">
                  <Upload size={15} /> Select Backup File
                  <input type="file" accept=".json,application/json"
                    onChange={handleFileChange} style={{ display:'none' }} />
                </label>
              )}

              {restErr && (
                <div className="br-error">
                  <AlertTriangle size={14} style={{ flexShrink:0, marginTop:1 }} />
                  <span>{restErr}</span>
                </div>
              )}

              {preview && confMode === 'none' && (
                <>
                  <div className="br-preview">
                    <div className="br-preview-title">Backup Preview</div>
                    {preview.ownerEmail && (
                      <div style={Object.assign({}, row)}>
                        <span style={lbl}>Created by</span>
                        <span style={val}>{preview.ownerEmail}</span>
                      </div>
                    )}
                    <div style={row}><span style={lbl}>Backup date</span><span style={val}>{preview.exportedAt}</span></div>
                    <div style={row}><span style={lbl}>Books</span><span style={val}>{preview.books}</span></div>
                    <div style={row}><span style={lbl}>Transactions</span><span style={val}>{preview.transactions}</span></div>
                    <div style={row}><span style={lbl}>New to add</span><span style={Object.assign({}, val, { color: preview.newTxCount > 0 ? 'var(--success)' : 'var(--text-3)' })}>+{preview.newTxCount}</span></div>
                    <div style={Object.assign({}, row, { borderBottom:'none' })}><span style={lbl}>Attachments</span><span style={val}>{preview.attachments}</span></div>
                  </div>
                  <button className="btn btn-primary btn-full br-action-btn"
                    onClick={function () { setConfMode('merge-confirm'); }} disabled={busy} type="button">
                    <GitMerge size={15} /> Merge with Current Data
                  </button>
                  <button className="btn br-action-btn"
                    style={{ background:'none', border:'1px solid var(--border)', color:'var(--text-3)', fontSize:12, height:38 }}
                    onClick={function () { setConfMode('replace-confirm'); }} disabled={busy} type="button">
                    <RefreshCw size={13} /> Replace Everything Instead
                  </button>
                </>
              )}

              {confMode === 'merge-confirm' && (
                <div className="br-confirm">
                  <div className="br-confirm-title" style={{ color:'var(--accent-light)' }}>Confirm Smart Merge</div>
                  <p className="br-confirm-text"><strong>+{preview && preview.newTxCount} missing transaction{preview && preview.newTxCount !== 1 ? 's' : ''}</strong> will be added. Nothing existing will be deleted.</p>
                  <div style={{ display:'flex', gap:10 }}>
                    <button className="btn btn-secondary btn-full" style={{ flex:1 }} onClick={function () { setConfMode('none'); }} disabled={busy} type="button">Cancel</button>
                    <button className="btn btn-primary btn-full" style={{ flex:1 }} onClick={handleMergeRestore} disabled={busy} type="button">{busy ? 'Merging…' : 'Yes, Merge'}</button>
                  </div>
                </div>
              )}

              {confMode === 'replace-confirm' && (
                <div className="br-confirm">
                  <div className="br-confirm-title">⚠️ Replace Everything?</div>
                  <p className="br-confirm-text">This will <strong>permanently delete all current data</strong> and replace it with the backup from <strong>{preview && preview.exportedAt}</strong>. This cannot be undone.</p>
                  <div style={{ display:'flex', gap:10 }}>
                    <button className="btn btn-secondary btn-full" style={{ flex:1 }} onClick={function () { setConfMode('none'); }} disabled={busy} type="button">Cancel</button>
                    <button className="btn btn-danger btn-full" style={{ flex:1 }} onClick={handleReplaceRestore} disabled={busy} type="button">{busy ? 'Replacing…' : 'Yes, Replace All'}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
