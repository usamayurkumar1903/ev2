import { useState, useEffect } from 'react';
import { X, Camera, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { CATEGORIES, EXPENSE_CATS, INCOME_CATS, getCat } from '../utils/constants';
import { ICONS } from './CategoryIcon';
import { MoreHorizontal } from 'lucide-react';
import { saveAttachment, getAttachment, deleteAttachment } from '../utils/db';
import Portal from './Portal';

var ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function TransactionModal({ open, onClose, editTx, defaultType }) {
  var app = useApp();
  var addTx = app.addTx; var updTx = app.updTx;
  var activeBookId = app.activeBookId; var settings = app.settings;
  var toast = useToast().toast;

  var typeS   = useState('income');  var type   = typeS[0]; var setType   = typeS[1];
  var amtS    = useState('');        var amount = amtS[0];  var setAmount = amtS[1];
  var catS    = useState('food');    var category = catS[0]; var setCategory = catS[1];
  var dateS   = useState(new Date().toISOString().slice(0,10)); var date = dateS[0]; var setDate = dateS[1];
  var notesS  = useState('');        var notes  = notesS[0]; var setNotes  = notesS[1];

  // ── Attachment state ──
  var fileS      = useState(null);  var attachFile = fileS[0];      var setAttachFile = fileS[1];        // newly chosen File, pending save
  var previewS   = useState(null);  var previewUrl = previewS[0];   var setPreviewUrl = previewS[1];     // object URL for thumbnail (new or existing)
  var hasExistS  = useState(false); var hasExisting = hasExistS[0]; var setHasExisting = hasExistS[1];   // editTx already has a saved attachment
  var removeS    = useState(false); var removeExisting = removeS[0]; var setRemoveExisting = removeS[1]; // user removed the existing attachment
  var attachErrS = useState('');    var attachError = attachErrS[0]; var setAttachError = attachErrS[1];

  useEffect(function() {
    if (editTx) {
      setType(editTx.type);
      setAmount(String(editTx.amount));
      setCategory(editTx.category);
      setDate(editTx.date);
      setNotes(editTx.notes || '');

      setAttachFile(null);
      setRemoveExisting(false);
      setAttachError('');
      if (editTx.attachment) {
        setHasExisting(true);
        getAttachment(editTx.id).then(function(rec) {
          if (rec && rec.blob) setPreviewUrl(URL.createObjectURL(rec.blob));
        }).catch(function() {});
      } else {
        setHasExisting(false);
        setPreviewUrl(null);
      }
    } else {
      setType('income');
      setAmount('');
      setCategory(defaultType === 'expense' ? 'food' : 'salary');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      if (defaultType) setType(defaultType);

      setAttachFile(null);
      setPreviewUrl(null);
      setHasExisting(false);
      setRemoveExisting(false);
      setAttachError('');
    }
  }, [editTx, open, defaultType]);

  // Revoke the previous preview object URL whenever it's replaced/cleared, and on unmount.
  useEffect(function() {
    return function() { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  if (!open) return null;

  var cats = (type === 'expense' ? EXPENSE_CATS : INCOME_CATS)
    .map(function(id) { return getCat(id); });

  function handleFileSelect(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (ATTACHMENT_TYPES.indexOf(file.type) === -1) {
      setAttachError('Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachError('');
    setAttachFile(file);
    setRemoveExisting(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveAttachment() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachFile(null);
    setPreviewUrl(null);
    setAttachError('');
    if (hasExisting) setRemoveExisting(true);
  }

  function persistAttachment(txId) {
    if (attachFile) {
      saveAttachment(txId, attachFile).catch(function() { toast('Could not save attachment', 'error'); });
    } else if (removeExisting) {
      deleteAttachment(txId).catch(function() {});
    }
  }

  function handleSubmit() {
    var n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) { toast('Enter a valid amount', 'error'); return; }
    var willHaveAttachment = attachFile ? true : (hasExisting && !removeExisting);
    var data = { type: type, amount: n, category: category, date: date, notes: notes.trim(), bookId: activeBookId, attachment: willHaveAttachment };
    if (editTx) {
      updTx(Object.assign({ id: editTx.id }, data));
      persistAttachment(editTx.id);
      toast('Transaction updated', 'success');
    } else {
      var newId = uuidv4();
      addTx(Object.assign({ id: newId }, data));
      persistAttachment(newId);
      toast('Transaction added', 'success');
    }
    onClose();
  }

  /*
   * Same bm-* structure as BookModal:
   *   .bm-overlay  — fixed backdrop, aligns sheet to bottom
   *   .bm-sheet    — max-height:90dvh, overflow:hidden (clips to visible area)
   *   .bm-handle   — drag pill, outside scroll
   *   .bm-header   — title row, outside scroll
   *   .bm-scroll   — overflow-y:auto, padding-bottom:120px (scrolls internally)
   *
   * This is the only pattern that keeps all content visible when the
   * mobile keyboard opens, because dvh shrinks with the visual viewport.
   */
  return (
    <Portal>
    <div className="bm-overlay" onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bm-sheet">

        <div className="bm-handle" />

        <div className="bm-header">
          <span className="sheet-title">{editTx ? 'Edit Transaction' : 'New Transaction'}</span>
          <button className="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        <div className="bm-scroll">

          {/* ── Type toggle: Income (green, left) | Expense (red, right) ── */}
          <div className="tx-type-toggle">
            <button
              type="button"
              className={'tx-type-btn income' + (type === 'income' ? ' active' : '')}
              onClick={function() { setType('income'); setCategory('salary'); }}
            >
              Income
            </button>
            <button
              type="button"
              className={'tx-type-btn expense' + (type === 'expense' ? ' active' : '')}
              onClick={function() { setType('expense'); setCategory('food'); }}
            >
              Expense
            </button>
          </div>

          {/* ── Amount ── */}
          <div className="form-group">
            <label className="form-label">Amount ({settings.currency})</label>
            <input
              type="number"
              className={'form-input tx-amount-input' + (type === 'income' ? ' income-focus' : ' expense-focus')}
              placeholder="0.00"
              value={amount}
              onChange={function(e) { setAmount(e.target.value); }}
              min="0"
              step="0.01"
              inputMode="decimal"
              enterKeyHint="next"
              autoFocus={!editTx}
            />
          </div>

          {/* ── Category ── */}
          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="cat-grid">
              {cats.map(function(cat) {
                var Icon = ICONS[cat.id] || MoreHorizontal;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={'cat-opt' + (category === cat.id ? ' selected' : '')}
                    onClick={function() { setCategory(cat.id); }}
                  >
                    <div className="cat-opt-icon" style={{ background: cat.bg }}>
                      <Icon size={16} style={{ color: cat.color }} strokeWidth={1.8} />
                    </div>
                    <span className="cat-opt-label">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Date ── */}
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input form-select"
              value={date}
              onChange={function(e) { setDate(e.target.value); }}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* ── Notes ── */}
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              placeholder="Add a note…"
              value={notes}
              onChange={function(e) { setNotes(e.target.value); }}
              rows={2}
            />
          </div>

          {/* ── Attachment ── */}
          <div className="form-group">
            <label className="form-label">Attachment (optional)</label>

            {previewUrl ? (
              <div className="attach-preview">
                <img src={previewUrl} alt="Receipt preview" className="attach-thumb" />
                <div className="attach-preview-actions">
                  <label className="attach-btn">
                    Replace
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button type="button" className="attach-btn attach-btn-danger" onClick={handleRemoveAttachment}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="attach-actions">
                <label className="attach-btn">
                  <ImageIcon size={14} /> Upload
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>
                <label className="attach-btn">
                  <Camera size={14} /> Camera
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}

            {attachError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{attachError}</div>
            )}
          </div>

          {/* ── Submit ── */}
          <button
            type="button"
            className={'btn btn-full tx-submit-btn' + (type === 'income' ? ' income-btn' : ' expense-btn')}
            onClick={handleSubmit}
            style={{ height: 48, fontSize: 15, marginTop: 4 }}
          >
            {editTx
              ? 'Save Changes'
              : (type === 'income' ? 'Add Income' : 'Add Expense')}
          </button>

        </div>{/* end .bm-scroll */}
      </div>{/* end .bm-sheet */}
    </div>
    </Portal>
  );
}
