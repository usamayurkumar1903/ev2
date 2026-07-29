import Portal from './Portal';
import { useState, useEffect } from 'react';
import {
  X, Briefcase, User, Home, Plane,
  Target, Lightbulb, Star, Lock, Gem, Wallet,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { BOOK_COLORS } from '../utils/constants';

var BOOK_ICONS = [
  { id: 'user',      Icon: User      },
  { id: 'briefcase', Icon: Briefcase },
  { id: 'home',      Icon: Home      },
  { id: 'plane',     Icon: Plane     },
  { id: 'target',    Icon: Target    },
  { id: 'bulb',      Icon: Lightbulb },
  { id: 'star',      Icon: Star      },
  { id: 'lock',      Icon: Lock      },
  { id: 'gem',       Icon: Gem       },
  { id: 'wallet',    Icon: Wallet    },
];

export default function BookModal({ open, onClose, editBook }) {
  var app     = useApp();
  var toast   = useToast().toast;
  var addBook = app.addBook;
  var updBook = app.updBook;
  var books   = app.books;

  var ns = useState('');   var name  = ns[0];  var setName  = ns[1];
  var cs = useState(BOOK_COLORS[0]); var color = cs[0]; var setColor = cs[1];
  var is = useState('user'); var iconId = is[0]; var setIconId = is[1];

  useEffect(function () {
    if (!open) return;
    if (editBook) {
      setName(editBook.name);
      setColor(editBook.color);
      setIconId(editBook.iconId || 'user');
    } else {
      setName('');
      setColor(BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]);
      setIconId('user');
    }
  }, [editBook, open]);

  if (!open) return null;

  function handleSubmit() {
    var trimmed = name.trim();
    if (!trimmed) { toast('Enter a book name', 'error'); return; }
    var dup = books.some(function (b) {
      return b.name.toLowerCase() === trimmed.toLowerCase() &&
             (!editBook || b.id !== editBook.id);
    });
    if (dup) { toast('A book with this name already exists', 'error'); return; }
    var data = { name: trimmed, color: color, iconId: iconId };
    if (editBook) { updBook(Object.assign({ id: editBook.id }, data)); toast('Book updated', 'success'); }
    else          { addBook(data);                                      toast('Book created', 'success'); }
    onClose();
  }

  var selIcon     = BOOK_ICONS.find(function (i) { return i.id === iconId; }) || BOOK_ICONS[0];
  var SelIconComp = selIcon.Icon;

  /*
   * STRUCTURE (the only pattern that works reliably on mobile):
   *
   *  .bm-overlay          – position:fixed backdrop, flex-end
   *    .bm-sheet          – position:relative, max-height:90dvh, overflow:hidden
   *                         This clips the sheet to the visual area.
   *      .bm-handle       – drag handle (not scrollable)
   *      .bm-header       – title + close (not scrollable)
   *      .bm-scroll       – overflow-y:auto, -webkit-overflow-scrolling:touch
   *                         padding-bottom:120px ensures button is above keyboard.
   *                         THIS div scrolls when keyboard opens.
   *
   * Why this works:
   *  - The outer .bm-sheet is capped at 90dvh. dvh = dynamic viewport height,
   *    which SHRINKS when the mobile keyboard opens. So the sheet always fits
   *    inside whatever space is left above the keyboard.
   *  - The inner .bm-scroll scrolls freely within that capped height, so the
   *    user can reach the input and every other field without clipping.
   *  - overflow:hidden on .bm-sheet prevents the sheet itself from expanding
   *    beyond 90dvh and spilling underneath the keyboard.
   */
  return (
    <Portal><div
      className="bm-overlay"
      onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bm-sheet">

        {/* ── Handle – stays fixed at top, not scrolled ── */}
        <div className="bm-handle" />

        {/* ── Header – stays fixed at top, not scrolled ── */}
        <div className="bm-header">
          <span className="sheet-title">
            {editBook ? 'Edit Book' : 'New Book'}
          </span>
          <button className="btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable content area ── */}
        <div className="bm-scroll">

          {/* Live preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: 14, marginBottom: 20,
            background: 'rgba(10,132,255,0.08)',
            borderRadius: 12,
            border: '1px solid rgba(10,132,255,0.2)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <SelIconComp size={20} color="#fff" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {name || 'Book Name'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {editBook ? 'Editing book' : 'New book'}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              placeholder="e.g. Personal, Business…"
              value={name}
              onChange={function (e) { setName(e.target.value); }}
              maxLength={24}
              inputMode="text"
              enterKeyHint="done"
              onKeyDown={function (e) {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
              }}
            />
          </div>

          {/* Icon */}
          <div className="form-group">
            <label className="form-label">Icon</label>
            <div className="icon-grid">
              {BOOK_ICONS.map(function (item) {
                var Ic = item.Icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={'icon-opt' + (iconId === item.id ? ' active' : '')}
                    onClick={function () { setIconId(item.id); }}
                  >
                    <Ic size={17} strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-grid">
              {BOOK_COLORS.map(function (c) {
                return (
                  <button
                    key={c}
                    type="button"
                    className={'color-swatch' + (color === c ? ' active' : '')}
                    style={{ background: c }}
                    onClick={function () { setColor(c); }}
                  />
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={handleSubmit}
            style={{ height: 48, fontSize: 15, marginTop: 4 }}
          >
            {editBook ? 'Save Changes' : 'Create Book'}
          </button>

        </div>{/* end .bm-scroll */}
      </div>{/* end .bm-sheet */}
    </div></Portal>
  );
}
