import { useState, useEffect } from 'react';
import { X, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { getCat, fmtFull } from '../utils/constants';
import ConfirmDialog from './ConfirmDialog';
import Portal from './Portal';
import { ICONS } from './CategoryIcon';
import { getAttachment } from '../utils/db';

export default function TransactionDetail({ tx, onClose, onEdit }) {
  var app = useApp();
  var delTx = app.delTx; var settings = app.settings;
  var toast = useToast().toast;
  var confirmState = useState(false);
  var confirmOpen = confirmState[0]; var setConfirmOpen = confirmState[1];
  var attachS = useState(null);   var attachUrl = attachS[0];   var setAttachUrl = attachS[1];
  var viewerS = useState(false);  var viewerOpen = viewerS[0];  var setViewerOpen = viewerS[1];

  useEffect(function() {
    setViewerOpen(false);
    if (tx && tx.attachment) {
      getAttachment(tx.id).then(function(rec) {
        if (rec && rec.blob) setAttachUrl(URL.createObjectURL(rec.blob));
      }).catch(function() {});
    } else {
      setAttachUrl(null);
    }
  }, [tx]);

  // Revoke the previous object URL whenever it's replaced/cleared, and on unmount.
  useEffect(function() {
    return function() { if (attachUrl) URL.revokeObjectURL(attachUrl); };
  }, [attachUrl]);

  if (!tx) return null;
  var cat = getCat(tx.category);

  function handleDelete() {
    delTx(tx.id);
    toast('Transaction deleted', 'success');
    setConfirmOpen(false);
    onClose();
  }

  var rows = [
    { label: 'Type',     value: tx.type === 'expense' ? 'Expense' : 'Income' },
    { label: 'Category', value: cat.label },
    { label: 'Date',     value: new Date(tx.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) },
    tx.notes ? { label: 'Notes', value: tx.notes } : null,
    { label: 'Added',    value: new Date(tx.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
  ].filter(Boolean);

  var Icon = ICONS[tx.category] || MoreHorizontal;

  return (
    <Portal>
      <>
      <div
        className="td-overlay"
        onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="td-card">

          {/* Close button */}
          <button
            className="btn-icon td-close"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>

          {/* Hero — icon + amount + category */}
          <div className="td-hero">
            <div className="td-icon" style={{ background: cat.bg }}>
              <Icon size={26} style={{ color: cat.color }} strokeWidth={1.8} />
            </div>
            <div
              className="td-amount"
              style={{ color: tx.type === 'expense' ? 'var(--danger)' : 'var(--success)' }}
            >
              {tx.type === 'expense' ? '−' : '+'}{fmtFull(tx.amount, settings.currency)}
            </div>
            <div className="td-cat-label">{cat.label}</div>
          </div>

          {/* Detail rows */}
          <div className="td-rows">
            {rows.map(function(row) {
              return (
                <div key={row.label} className="td-row">
                  <span className="td-row-label">{row.label}</span>
                  <span className="td-row-value">{row.value}</span>
                </div>
              );
            })}
          </div>

          {/* Attachment thumbnail */}
          {tx.attachment && (
            <div className="td-attachment">
              <div className="td-attachment-label">Attachment</div>
              {attachUrl ? (
                <button type="button" className="attach-thumb-btn" onClick={function() { setViewerOpen(true); }}>
                  <img src={attachUrl} alt="Receipt" className="attach-thumb" />
                </button>
              ) : (
                <div className="attach-thumb-loading">Loading…</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="td-actions">
            <button
              type="button"
              className="btn btn-secondary td-action-btn"
              onClick={function() { onClose(); onEdit(tx); }}
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              type="button"
              className="btn btn-danger td-action-btn"
              onClick={function() { setConfirmOpen(true); }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>

        </div>
      </div>

      {viewerOpen && attachUrl && (
        <div className="attach-viewer-overlay" onClick={function() { setViewerOpen(false); }}>
          <button
            className="btn-icon attach-viewer-close"
            onClick={function(e) { e.stopPropagation(); setViewerOpen(false); }}
            type="button"
          >
            <X size={18} />
          </button>
          <img
            src={attachUrl}
            alt="Receipt full view"
            className="attach-viewer-img"
            onClick={function(e) { e.stopPropagation(); }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Transaction?"
        description="This cannot be undone. The transaction will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={function() { setConfirmOpen(false); }}
      />
    </>
    </Portal>
  );
}
