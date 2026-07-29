import { useState, useMemo } from 'react';
import {
  Moon, Sun, Download, Trash2, Info, Check,
  ChevronRight, Search, BookOpen, Database, X,
  Calendar, ChevronLeft, Lock, ShieldCheck, ArchiveRestore,
  Cloud, CloudOff, LogOut, User,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { CURRENCIES, getCat, fmtFull } from '../utils/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import PinSetupModal from '../components/PinSetupModal';
import BackupRestoreModal from '../components/BackupRestoreModal';
import Portal from '../components/Portal';
import { isPinLockEnabled } from '../utils/pin';
import { clearAllAttachments } from '../utils/db';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../utils/supabase';
import { getQueue } from '../utils/offlineQueue';

/* ─── Shared UI helpers ─────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div className="settings-section">
      {title && <div className="settings-section-title">{title}</div>}
      <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />;
}

function Row({ icon, iconBg, iconColor, label, sub, right, onClick, danger }) {
  var Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="setting-row" onClick={onClick}>
      <div className="setting-row-icon" style={{ background: iconBg || 'var(--bg-input)' }}>
        <span style={{ color: iconColor || (danger ? 'var(--danger)' : 'var(--text-2)'), display: 'flex' }}>
          {icon}
        </span>
      </div>
      <div className="setting-row-body">
        <div className="setting-row-label" style={{ color: danger ? 'var(--danger)' : undefined }}>
          {label}
        </div>
        {sub && <div className="setting-row-sub">{sub}</div>}
      </div>
      {right !== undefined
        ? right
        : (onClick && <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />)}
    </Tag>
  );
}

/* ─── PDF builder ───────────────────────────────────────────────── */

function buildPDF(txList, allBooks, currency, title, groupByBook) {
  var bookMap = {};
  allBooks.forEach(function(b) { bookMap[b.id] = b; });

  var totalIncome  = txList.filter(function(t) { return t.type === 'income';  }).reduce(function(s, t) { return s + t.amount; }, 0);
  var totalExpense = txList.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  var balance      = totalIncome - totalExpense;
  var dateStr      = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  var css = [
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0;}',
    'html{font-size:15px;}',
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",sans-serif;',
         'background:#f4f4f8;color:#111;padding:1.5rem;line-height:1.45;}',

    /* Page title */
    '.rpt-title{font-size:1.4rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:0.15rem;}',
    '.rpt-meta{font-size:0.75rem;color:#999;margin-bottom:1.2rem;}',

    /* 3-column summary strip */
    '.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;',
              'border:1px solid #e0e0e8;border-radius:0.75rem;overflow:hidden;margin-bottom:1.4rem;}',
    '.s-cell{background:#fff;padding:0.75rem 0.9rem;border-right:1px solid #e0e0e8;}',
    '.s-cell:last-child{border-right:none;}',
    '.s-lbl{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:0.25rem;}',
    '.s-val{font-size:0.95rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* Book section */
    '.book-hd{font-size:0.95rem;font-weight:700;margin:1.4rem 0 0.6rem;padding-bottom:0.4rem;',
              'border-bottom:2px solid #e0e0e8;display:flex;align-items:baseline;gap:0.5rem;}',
    '.book-hd-count{font-size:0.7rem;font-weight:500;color:#aaa;}',
    '.book-summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;',
                  'border:1px solid #e0e0e8;border-radius:0.5rem;overflow:hidden;margin-bottom:0.8rem;}',
    '.bs-cell{background:#fafafa;padding:0.55rem 0.75rem;border-right:1px solid #e0e0e8;}',
    '.bs-cell:last-child{border-right:none;}',
    '.bs-lbl{font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#bbb;margin-bottom:0.15rem;}',
    '.bs-val{font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

    /* Transaction cards — NO table, NO word-wrap */
    '.tx-list{display:flex;flex-direction:column;gap:0;}',
    '.tx-card{background:#fff;border:1px solid #e8e8f0;border-radius:0;',
              'padding:0.6rem 0.9rem;border-bottom:none;}',
    '.tx-card:first-child{border-radius:0.6rem 0.6rem 0 0;}',
    '.tx-card:last-child{border-radius:0 0 0.6rem 0.6rem;border-bottom:1px solid #e8e8f0;}',
    '.tx-card:only-child{border-radius:0.6rem;border-bottom:1px solid #e8e8f0;}',
    '.tx-row{display:flex;align-items:center;gap:0.5rem;}',
    '.tx-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}',
    '.tx-main{flex:1;min-width:0;}',
    '.tx-top{display:flex;align-items:center;gap:0.4rem;}',
    '.tx-cat{font-size:0.8rem;font-weight:600;color:#111;white-space:nowrap;}',
    '.tx-book{font-size:0.7rem;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.tx-note{font-size:0.7rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.05rem;}',
    '.tx-right{text-align:right;flex-shrink:0;min-width:5rem;}',
    '.tx-amt{font-size:0.85rem;font-weight:700;white-space:nowrap;}',
    '.tx-date{font-size:0.65rem;color:#bbb;white-space:nowrap;margin-top:0.1rem;}',

    /* Colours */
    '.inc{color:#1a9e4a;}.exp{color:#d93025;}.bal-p{color:#1a6fc4;}.bal-n{color:#d93025;}',

    /* Footer */
    '.footer{margin-top:1.5rem;padding-top:0.75rem;border-top:1px solid #eee;',
             'font-size:0.65rem;color:#ccc;text-align:center;}',

    /* Print */
    '@media print{',
      'body{background:#fff;padding:1rem;}',
      '.page-break{page-break-before:always;margin-top:1rem;}',
    '}',
  ].join('');

  function amtStr(t) { return (t.type==='expense'?'−':'+')+fmtFull(t.amount,currency); }
  function amtCls(t) { return t.type==='expense'?'exp':'inc'; }
  function dotColor(t) { return t.type==='expense'?'#d93025':'#1a9e4a'; }

  function buildCards(txs) {
    var sorted = txs.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    if (!sorted.length) return '<div style="padding:1rem;text-align:center;color:#bbb;font-size:0.8rem;">No transactions</div>';
    return '<div class="tx-list">' + sorted.map(function(t) {
      var cat  = getCat(t.category);
      var bk   = bookMap[t.bookId];
      var bName = bk ? bk.name : '';
      return '<div class="tx-card">' +
        '<div class="tx-row">' +
          '<div class="tx-dot" style="background:'+dotColor(t)+'"></div>' +
          '<div class="tx-main">' +
            '<div class="tx-top">' +
              '<span class="tx-cat">'+cat.label+'</span>' +
              (bName ? '<span class="tx-book">· '+bName+'</span>' : '') +
            '</div>' +
            (t.notes ? '<div class="tx-note">'+t.notes+'</div>' : '') +
          '</div>' +
          '<div class="tx-right">' +
            '<div class="tx-amt '+amtCls(t)+'">'+amtStr(t)+'</div>' +
            '<div class="tx-date">'+t.date+'</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function sumBar(inc, exp, bal, big) {
    var bc = bal>=0?'bal-p':'bal-n'; var bs = bal>=0?'+':'−';
    var cell = big ? '.s-cell' : '.bs-cell';  /* same markup, different class handled by caller */
    var _ = big;
    if (big) {
      return '<div class="summary">' +
        '<div class="s-cell"><div class="s-lbl">Income</div><div class="s-val inc">+'+fmtFull(inc,currency)+'</div></div>' +
        '<div class="s-cell"><div class="s-lbl">Expenses</div><div class="s-val exp">−'+fmtFull(exp,currency)+'</div></div>' +
        '<div class="s-cell"><div class="s-lbl">Balance</div><div class="s-val '+bc+'">'+bs+fmtFull(Math.abs(bal),currency)+'</div></div>' +
      '</div>';
    } else {
      return '<div class="book-summary">' +
        '<div class="bs-cell"><div class="bs-lbl">Income</div><div class="bs-val inc">+'+fmtFull(inc,currency)+'</div></div>' +
        '<div class="bs-cell"><div class="bs-lbl">Expenses</div><div class="bs-val exp">−'+fmtFull(exp,currency)+'</div></div>' +
        '<div class="bs-cell"><div class="bs-lbl">Balance</div><div class="bs-val '+bc+'">'+bs+fmtFull(Math.abs(bal),currency)+'</div></div>' +
      '</div>';
    }
  }

  var body = '';

  if (groupByBook) {
    var bookIds = [];
    txList.forEach(function(t){ if(bookIds.indexOf(t.bookId)===-1) bookIds.push(t.bookId); });

    body = '<div class="rpt-title">'+title+'</div>' +
      '<div class="rpt-meta">Generated '+dateStr+' &nbsp;·&nbsp; '+txList.length+' transaction'+(txList.length!==1?'s':'')+' across '+bookIds.length+' book'+(bookIds.length!==1?'s':'')+'</div>' +
      sumBar(totalIncome, totalExpense, balance, true);

    bookIds.forEach(function(bid, idx) {
      var bk   = bookMap[bid];
      var bName = bk ? bk.name : 'Unknown Book';
      var bTxs = txList.filter(function(t){return t.bookId===bid;});
      var bInc = bTxs.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+t.amount;},0);
      var bExp = bTxs.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+t.amount;},0);
      body += (idx>0?'<div class="page-break"></div>':'') +
        '<div class="book-hd">'+bName+'<span class="book-hd-count">'+bTxs.length+' transaction'+(bTxs.length!==1?'s':'')+'</span></div>' +
        sumBar(bInc, bExp, bInc-bExp, false) +
        buildCards(bTxs);
    });
  } else {
    body = '<div class="rpt-title">'+title+'</div>' +
      '<div class="rpt-meta">Generated '+dateStr+' &nbsp;·&nbsp; '+txList.length+' transaction'+(txList.length!==1?'s':'')+'</div>' +
      sumBar(totalIncome, totalExpense, balance, true) +
      buildCards(txList);
  }

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>'+title+'</title>' +
    '<style>'+css+'</style>' +
    '</head><body>'+body+
    '<div class="footer">Expense Tracker &nbsp;·&nbsp; All data is private and stored locally on your device.</div>' +
    '</body></html>';
}
function openPrint(html, filename) {
  /*
   * True PDF export strategy:
   *
   * 1. Create a Blob URL from the HTML.
   * 2. Open it in a new tab — this works reliably on desktop and
   *    most Android browsers when triggered from a button click
   *    (same user-gesture requirement as a normal link click).
   * 3. Once the tab loads, call window.print() so the browser's
   *    native Print dialog opens immediately. The user selects
   *    "Save as PDF" (or a printer) — this produces a real PDF file.
   * 4. As a fallback for browsers that block the popup, we also
   *    trigger a direct .html download so the user still gets the file.
   *
   * Why not Blob + <a download=".pdf"> directly?
   *   Browsers refuse to render blob: URLs as PDF without a PDF
   *   engine — they would just download a blank file. The only
   *   way to get a real PDF from HTML in a browser is Print → Save as PDF.
   */
  try {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);

    /* Try to open a print-ready tab */
    var win = window.open(url, '_blank');

    if (win) {
      /* Inject auto-print script so dialog opens immediately */
      win.onload = function() {
        try { win.focus(); win.print(); } catch(e) {}
      };
      /* Fallback: if onload doesn't fire (some browsers), use timeout */
      setTimeout(function() {
        try { if (win && !win.closed) { win.focus(); win.print(); } } catch(e) {}
      }, 1200);
      setTimeout(function() { URL.revokeObjectURL(url); }, 30000);
      return 'print';
    } else {
      /* Popup blocked — fall back to direct download */
      var a = document.createElement('a');
      a.href     = url;
      a.download = (filename || 'expense-report') + '.html';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
      return 'download';
    }
  } catch(err) {
    console.error('Export failed:', err);
    return false;
  }
}
/* ─── Date range helpers ────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
}

function filterByDateRange(txs, from, to) {
  return txs.filter(function(t) {
    if (from && t.date < from) return false;
    if (to   && t.date > to)   return false;
    return true;
  });
}

/* ─── Export Wizard Modal ───────────────────────────────────────── */
/*
 * Step 1 → choose scope: specific book | all books
 * Step 2 → pick date range (optional)
 * Step 3 → confirm & print
 */

function ExportWizard({ open, onClose, books, transactions, currency }) {
  var stepState   = useState(1);   var step    = stepState[0];   var setStep    = stepState[1];
  var scopeState  = useState('all'); var scope  = scopeState[0];  var setScope   = scopeState[1];
  var bookIdState = useState('');   var selBook = bookIdState[0]; var setSelBook = bookIdState[1];
  var fromState   = useState('');   var from    = fromState[0];   var setFrom    = fromState[1];
  var toState     = useState('');   var to      = toState[0];     var setTo      = toState[1];
  var toast       = useToast().toast;

  // Reset on open
  var prevOpen = useState(false);
  if (open && !prevOpen[0]) {
    prevOpen[1](true);
    setStep(1);
    setScope('all');
    setSelBook('');
    setFrom('');
    setTo('');
  }
  if (!open && prevOpen[0]) { prevOpen[1](false); }

  if (!open) return null;

  function handleExport() {
    var bookList   = scope === 'all' ? books : books.filter(function(b) { return b.id === selBook; });
    var bookIds    = bookList.map(function(b) { return b.id; });
    var txPool     = transactions.filter(function(t) { return bookIds.indexOf(t.bookId) !== -1; });
    var txFiltered = filterByDateRange(txPool, from, to);

    if (txFiltered.length === 0) { toast('No transactions in this range', 'error'); return; }

    var title = scope === 'all'
      ? 'Full Expense Report' + (from || to ? ' (filtered)' : '')
      : 'Report — ' + (bookList[0] ? bookList[0].name : 'Book') + (from || to ? ' (filtered)' : '');

    /* Build a safe filename: lowercase, spaces→dashes, no special chars */
    var dateSuffix  = new Date().toISOString().slice(0, 10);
    var bookSlug    = scope === 'all' ? 'full-report' : (bookList[0] ? bookList[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'book');
    var filename    = bookSlug + '-' + dateSuffix;

    var html = buildPDF(txFiltered, books, currency, title, scope === 'all');
    var ok   = openPrint(html, filename);
    if (ok === 'print') { toast('Print dialog opening… choose “Save as PDF”', 'success'); onClose(); }
    else if (ok === 'download') { toast('Saved as file — open it and print to PDF', 'success'); onClose(); }
    else toast('Export failed. Please try again.', 'error');
  }

  // Quick date presets
  function applyPreset(preset) {
    var now = new Date();
    if (preset === 'thisMonth') {
      setFrom(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01');
      setTo(todayStr());
    } else if (preset === 'lastMonth') {
      var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(lm.getFullYear() + '-' + String(lm.getMonth() + 1).padStart(2, '0') + '-01');
      setTo(lmEnd.getFullYear() + '-' + String(lmEnd.getMonth() + 1).padStart(2, '0') + '-' + String(lmEnd.getDate()).padStart(2, '0'));
    } else if (preset === 'thisYear') {
      setFrom(now.getFullYear() + '-01-01');
      setTo(todayStr());
    } else if (preset === 'all') {
      setFrom(''); setTo('');
    }
  }

  var inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 10, fontSize: 14, color: 'var(--text)' };
  var labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' };
  var presetStyle = { padding: '5px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer' };

  return (
    <Portal><><div className="dialog-overlay" onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)',
        borderRadius: 20, width: 'calc(100% - 40px)', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        animation: 'dialog-in 200ms cubic-bezier(0.34,1.26,0.64,1) forwards',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 2 && (
              <button className="btn-icon" style={{ width: 28, height: 28, marginLeft: -4 }}
                onClick={function() { setStep(1); }}>
                <ChevronLeft size={16} />
              </button>
            )}
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {step === 1 ? 'Export PDF' : 'Date Range'}
            </span>
          </div>
          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Step 1: Choose book scope ── */}
          {step === 1 && (
            <>
              <div>
                <span style={labelStyle}>Select Book</span>

                {/* All books option */}
                <div
                  onClick={function() { setScope('all'); setSelBook(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    border: '1.5px solid ' + (scope === 'all' ? 'var(--accent)' : 'var(--border)'),
                    background: scope === 'all' ? 'var(--accent-dim)' : 'var(--bg-input)',
                    marginBottom: 8, transition: 'all 120ms ease',
                  }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(48,209,88,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Database size={16} style={{ color: 'var(--success)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>All Books</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Segregated by book name</div>
                  </div>
                  {scope === 'all' && <Check size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </div>

                {/* Individual books */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {books.map(function(b) {
                    var bTxCount = transactions.filter(function(t) { return t.bookId === b.id; }).length;
                    var isSelected = scope === 'book' && selBook === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={function() { setScope('book'); setSelBook(b.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                          border: '1.5px solid ' + (isSelected ? b.color : 'var(--border)'),
                          background: isSelected ? b.color + '14' : 'var(--bg-input)',
                          transition: 'all 120ms ease',
                        }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: b.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <BookOpen size={16} style={{ color: b.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{bTxCount} transaction{bTxCount !== 1 ? 's' : ''}</div>
                        </div>
                        {isSelected && <Check size={16} style={{ color: b.color, flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="btn btn-primary btn-full"
                style={{ height: 46, fontSize: 14 }}
                onClick={function() { setStep(2); }}>
                Next: Date Range →
              </button>
            </>
          )}

          {/* ── Step 2: Date range ── */}
          {step === 2 && (
            <>
              {/* Presets */}
              <div>
                <span style={labelStyle}>Quick Presets</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'all',       label: 'All time' },
                    { id: 'thisMonth', label: 'This month' },
                    { id: 'lastMonth', label: 'Last month' },
                    { id: 'thisYear',  label: 'This year' },
                  ].map(function(p) {
                    return (
                      <button key={p.id} style={presetStyle}
                        onClick={function() { applyPreset(p.id); }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* From */}
              <div>
                <span style={labelStyle}>From Date</span>
                <input
                  type="date" style={inputStyle}
                  value={from} max={to || todayStr()}
                  onChange={function(e) { setFrom(e.target.value); }}
                />
              </div>

              {/* To */}
              <div>
                <span style={labelStyle}>To Date</span>
                <input
                  type="date" style={inputStyle}
                  value={to} min={from} max={todayStr()}
                  onChange={function(e) { setTo(e.target.value); }}
                />
              </div>

              {(from || to) && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-input)', borderRadius: 8, padding: '8px 12px' }}>
                  {from ? from : 'beginning'} → {to ? to : 'today'}
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                style={{ height: 46, fontSize: 14 }}
                onClick={handleExport}>
                <Download size={15} /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div></></Portal>
  );
}

/* ─── Clear Selected Book Wizard ────────────────────────────────── */
/* Pick a single book → confirm → delBook() removes the book, its
 * transactions, and (via AppContext) their IndexedDB attachments. */

function ClearBookWizard({ open, onClose, books, transactions, delBook }) {
  var toast = useToast().toast;
  var selS = useState('');     var selBookId  = selS[0];  var setSelBookId  = selS[1];
  var confS = useState(false); var confirmOpen = confS[0]; var setConfirmOpen = confS[1];

  var prevOpen = useState(false);
  if (open && !prevOpen[0]) { prevOpen[1](true); setSelBookId(''); setConfirmOpen(false); }
  if (!open && prevOpen[0]) { prevOpen[1](false); }

  if (!open) return null;

  var selBook  = books.find(function(b) { return b.id === selBookId; });
  var selCount = selBook ? transactions.filter(function(t) { return t.bookId === selBook.id; }).length : 0;

  function handleDeleteClick() {
    if (!selBook) { toast('Select a book first', 'error'); return; }
    if (books.length <= 1) { toast("Can't delete the only book", 'error'); return; }
    setConfirmOpen(true);
  }

  function handleConfirm() {
    delBook(selBook.id);
    toast('"' + selBook.name + '" deleted', 'success');
    setConfirmOpen(false);
    onClose();
  }

  var labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' };

  return (
    <>
      <Portal><div className="dialog-overlay" onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 20, width: 'calc(100% - 40px)', maxWidth: 400,
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          animation: 'dialog-in 200ms cubic-bezier(0.34,1.26,0.64,1) forwards',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Clear Selected Book</span>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={onClose}><X size={16} /></button>
          </div>

          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={labelStyle}>Select Book to Delete</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {books.map(function(b) {
                  var bTxCount = transactions.filter(function(t) { return t.bookId === b.id; }).length;
                  var isSelected = selBookId === b.id;
                  return (
                    <div key={b.id} onClick={function() { setSelBookId(b.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                        border: '1.5px solid ' + (isSelected ? 'var(--danger)' : 'var(--border)'),
                        background: isSelected ? 'var(--danger-dim)' : 'var(--bg-input)',
                        transition: 'all 120ms ease',
                      }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: b.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={16} style={{ color: b.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{bTxCount} transaction{bTxCount !== 1 ? 's' : ''}</div>
                      </div>
                      {isSelected && <Check size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              className="btn btn-danger btn-full"
              style={{ height: 46, fontSize: 14 }}
              onClick={handleDeleteClick}
            >
              <Trash2 size={15} /> Delete Book
            </button>
          </div>
        </div>
      </div></Portal>

      <ConfirmDialog
        open={confirmOpen}
        title={selBook ? 'Delete "' + selBook.name + '"?' : 'Delete Book?'}
        description={'This will permanently delete this book and its ' + selCount + ' transaction' + (selCount !== 1 ? 's' : '') + ', along with any attached receipts. Other books are not affected. This cannot be undone.'}
        confirmLabel="Delete Book"
        onConfirm={handleConfirm}
        onCancel={function() { setConfirmOpen(false); }}
      />
    </>
  );
}

/* ─── Clear Transactions by Date Range Wizard ───────────────────── */
/* Pick a book + date range → preview affected count → confirm →
 * delTxRange() removes only matching transactions (and their
 * attachments); everything outside the range, and other books,
 * stay untouched. Dashboard/Books balances recompute automatically
 * since they derive live from the transactions array. */

function ClearRangeWizard({ open, onClose, books, transactions, delTxRange }) {
  var toast = useToast().toast;
  var selS   = useState('');     var selBookId = selS[0];   var setSelBookId = selS[1];
  var fromS  = useState('');     var from      = fromS[0];  var setFrom      = fromS[1];
  var toS    = useState('');     var to        = toS[0];    var setTo        = toS[1];
  var confS  = useState(false);  var confirmOpen = confS[0]; var setConfirmOpen = confS[1];

  var prevOpen = useState(false);
  if (open && !prevOpen[0]) {
    prevOpen[1](true);
    setSelBookId(''); setFrom(''); setTo(''); setConfirmOpen(false);
  }
  if (!open && prevOpen[0]) { prevOpen[1](false); }

  if (!open) return null;

  var selBook = books.find(function(b) { return b.id === selBookId; });
  var matching = selBook ? transactions.filter(function(t) {
    if (t.bookId !== selBook.id) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  }) : [];

  function handlePreviewClick() {
    if (!selBook) { toast('Select a book first', 'error'); return; }
    if (!from || !to) { toast('Select both a start and end date', 'error'); return; }
    if (matching.length === 0) { toast('No transactions in this range', 'error'); return; }
    setConfirmOpen(true);
  }

  function handleConfirm() {
    var removedCount = matching.length;
    delTxRange(selBook.id, from, to);
    toast(removedCount + ' transaction' + (removedCount !== 1 ? 's' : '') + ' deleted', 'success');
    setConfirmOpen(false);
    onClose();
  }

  var inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 10, fontSize: 14, color: 'var(--text)' };
  var labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' };

  return (
    <>
      <Portal><div className="dialog-overlay" onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 20, width: 'calc(100% - 40px)', maxWidth: 400,
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          animation: 'dialog-in 200ms cubic-bezier(0.34,1.26,0.64,1) forwards',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Clear by Date Range</span>
            <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={onClose}><X size={16} /></button>
          </div>

          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <span style={labelStyle}>Select Book</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {books.map(function(b) {
                  var bTxCount = transactions.filter(function(t) { return t.bookId === b.id; }).length;
                  var isSelected = selBookId === b.id;
                  return (
                    <div key={b.id} onClick={function() { setSelBookId(b.id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                        border: '1.5px solid ' + (isSelected ? b.color : 'var(--border)'),
                        background: isSelected ? b.color + '14' : 'var(--bg-input)',
                        transition: 'all 120ms ease',
                      }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: b.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={16} style={{ color: b.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{bTxCount} transaction{bTxCount !== 1 ? 's' : ''}</div>
                      </div>
                      {isSelected && <Check size={16} style={{ color: b.color, flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span style={labelStyle}>From Date</span>
              <input type="date" style={inputStyle} value={from} max={to || todayStr()} onChange={function(e) { setFrom(e.target.value); }} />
            </div>

            <div>
              <span style={labelStyle}>To Date</span>
              <input type="date" style={inputStyle} value={to} min={from} max={todayStr()} onChange={function(e) { setTo(e.target.value); }} />
            </div>

            {selBook && from && to && (
              <div style={{ fontSize: 12, color: matching.length ? 'var(--danger)' : 'var(--text-3)', background: 'var(--bg-input)', borderRadius: 8, padding: '8px 12px' }}>
                {matching.length} transaction{matching.length !== 1 ? 's' : ''} in &ldquo;{selBook.name}&rdquo; from {from} to {to} will be permanently deleted.
              </div>
            )}

            <button
              className="btn btn-danger btn-full"
              style={{ height: 46, fontSize: 14 }}
              onClick={handlePreviewClick}
            >
              <Trash2 size={15} /> Preview &amp; Delete
            </button>
          </div>
        </div>
      </div></Portal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Transactions?"
        description={selBook ? ('This will permanently delete ' + matching.length + ' transaction' + (matching.length !== 1 ? 's' : '') + ' in "' + selBook.name + '" between ' + from + ' and ' + to + ', along with any attached receipts. Transactions outside this range, and other books, are not affected. This cannot be undone.') : ''}
        confirmLabel="Delete Transactions"
        onConfirm={handleConfirm}
        onCancel={function() { setConfirmOpen(false); }}
      />
    </>
  );
}

/* ─── Main Settings component ───────────────────────────────────── */

export default function Settings() {
  var app          = useApp();
  var settings     = app.settings;
  var setCurrency  = app.setCurrency;
  var setTheme     = app.setTheme;
  var transactions = app.transactions;
  var books        = app.books;
  var delBook      = app.delBook;
  var delTxRange   = app.delTxRange;
  var toast        = useToast().toast;
  var isDark       = settings.theme === 'dark';
  var authCtx      = useAuth();
  var user         = authCtx ? authCtx.user : null;
  var signOut      = authCtx ? authCtx.signOut : null;
  var queueLen     = getQueue().length;

  var clearConfirmS   = useState(false);
  var clearConfirm    = clearConfirmS[0]; var setClearConfirm    = clearConfirmS[1];
  var exportWizardS   = useState(false);
  var exportWizardOpen= exportWizardS[0]; var setExportWizardOpen= exportWizardS[1];
  var currSearchS     = useState('');
  var currSearch      = currSearchS[0];   var setCurrSearch      = currSearchS[1];
  var pinEnabledS      = useState(function() { return isPinLockEnabled(); });
  var pinEnabled       = pinEnabledS[0];  var setPinEnabled      = pinEnabledS[1];
  var pinModalS        = useState(null); // null | 'create' | 'change' | 'disable'
  var pinModalMode     = pinModalS[0];    var setPinModalMode    = pinModalS[1];
  var clearBookS       = useState(false); var clearBookOpen      = clearBookS[0]; var setClearBookOpen = clearBookS[1];
  var clearRangeS      = useState(false); var clearRangeOpen     = clearRangeS[0]; var setClearRangeOpen = clearRangeS[1];
  var backupOpenS      = useState(false); var backupOpen         = backupOpenS[0]; var setBackupOpen    = backupOpenS[1];

  var filteredCurrencies = useMemo(function() {
    if (!currSearch.trim()) return CURRENCIES;
    var q = currSearch.toLowerCase();
    return CURRENCIES.filter(function(c) {
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.symbol.includes(q);
    });
  }, [currSearch]);

  var selectedCode = useMemo(function() {
    var m = CURRENCIES.find(function(c) { return c.symbol === settings.currency; });
    return m ? m.code : null;
  }, [settings.currency]);

  function handleClear() {
    localStorage.removeItem('et-v2');
    clearAllAttachments().catch(function() {});
    toast('All data cleared', 'success');
    setClearConfirm(false);
    setTimeout(function() { window.location.reload(); }, 800);
  }

  function handleLockToggle(checked) {
    setPinModalMode(checked ? 'create' : 'disable');
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Settings</span>
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <Row
          icon={isDark ? <Moon size={16} /> : <Sun size={16} />}
          iconBg={isDark ? 'rgba(94,92,230,0.15)' : 'rgba(255,159,10,0.15)'}
          iconColor={isDark ? '#5E5CE6' : '#FF9F0A'}
          label="Light Mode"
          sub={isDark ? 'Currently dark' : 'Currently light'}
          right={
            <label className="toggle">
              <input type="checkbox" checked={!isDark}
                onChange={function(e) { setTheme(e.target.checked ? 'light' : 'dark'); }} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          }
        />
      </Section>

      {/* Currency */}
      <Section title="Currency">
        <div style={{ padding: '10px 14px 6px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
              placeholder="Search currencies…"
              value={currSearch}
              onChange={function(e) { setCurrSearch(e.target.value); }}
            />
          </div>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {filteredCurrencies.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No results</div>
          )}
          {filteredCurrencies.map(function(c, i) {
            var isActive = c.code === selectedCode;
            return (
              <div key={c.code}>
                {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />}
                <Row
                  icon={<span style={{ fontSize: 13, fontWeight: 700, minWidth: 14, textAlign: 'center' }}>{c.symbol}</span>}
                  label={c.name} sub={c.code}
                  onClick={function() { setCurrency(c.symbol); toast('Currency: ' + c.name, 'success'); }}
                  right={isActive ? <Check size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : null}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Account / Cloud Sync */}
      {isSupabaseConfigured && (
        <Section title="Account">
          {user ? (
            <>
              <Row
                icon={<Cloud size={16} />}
                iconBg="rgba(10,132,255,0.12)" iconColor="var(--accent)"
                label="Cloud Sync Active"
                sub={user.email || 'Signed in'}
                right={
                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, background: 'rgba(48,209,88,0.12)', padding: '3px 8px', borderRadius: 6 }}>
                    {queueLen > 0 ? queueLen + ' pending' : 'Synced'}
                  </span>
                }
              />
              <Divider />
              <Row
                icon={<LogOut size={16} />}
                iconBg="var(--danger-dim)" iconColor="var(--danger)"
                label="Sign Out"
                sub="Your data stays saved in the cloud"
                onClick={async function() {
                  try { await signOut(); localStorage.setItem('et-skip-auth','0'); } catch(e) {}
                }}
                danger
              />
            </>
          ) : (
            <Row
              icon={<CloudOff size={16} />}
              iconBg="var(--bg-input)" iconColor="var(--text-3)"
              label="Not signed in"
              sub="Sign in to sync across devices"
              onClick={function() { localStorage.removeItem('et-skip-auth'); window.location.reload(); }}
            />
          )}
        </Section>
      )}

      {/* Security */}
      <Section title="Security">
        <Row
          icon={<Lock size={16} />}
          iconBg="rgba(10,132,255,0.12)" iconColor="var(--accent)"
          label="App Lock"
          sub={pinEnabled ? 'PIN required to open the app' : 'Protect this app with a 4-digit PIN'}
          right={
            <label className="toggle">
              <input type="checkbox" checked={pinEnabled}
                onChange={function(e) { handleLockToggle(e.target.checked); }} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          }
        />
        {pinEnabled && (
          <>
            <Divider />
            <Row
              icon={<ShieldCheck size={16} />}
              iconBg="rgba(48,209,88,0.12)" iconColor="var(--success)"
              label="Change PIN"
              sub="Update your 4-digit PIN"
              onClick={function() { setPinModalMode('change'); }}
            />
          </>
        )}
      </Section>

      {/* Backup & Restore */}
      <Section title="Backup &amp; Restore">
        <Row
          icon={<ArchiveRestore size={16} />}
          iconBg="rgba(10,132,255,0.12)" iconColor="var(--accent)"
          label="Backup &amp; Restore"
          sub="Export or import a full local backup"
          onClick={function() { setBackupOpen(true); }}
        />
      </Section>

      {/* Data Management */}
      <Section title="Data Management">
        <Row
          icon={<Download size={16} />}
          iconBg="rgba(10,132,255,0.12)" iconColor="var(--accent)"
          label="Export as PDF"
          sub="Choose book & date range"
          onClick={function() { setExportWizardOpen(true); }}
        />
        <Divider />
        <Row
          icon={<BookOpen size={16} />}
          iconBg="var(--danger-dim)" iconColor="var(--danger)"
          label="Clear Selected Book"
          sub="Delete one book, its transactions & receipts"
          onClick={function() { setClearBookOpen(true); }}
          danger
        />
        <Divider />
        <Row
          icon={<Calendar size={16} />}
          iconBg="var(--danger-dim)" iconColor="var(--danger)"
          label="Clear by Date Range"
          sub="Delete a book's transactions within a range"
          onClick={function() { setClearRangeOpen(true); }}
          danger
        />
        <Divider />
        <Row
          icon={<Trash2 size={16} />}
          iconBg="var(--danger-dim)" iconColor="var(--danger)"
          label="Clear All Data"
          sub={transactions.length + ' transactions · ' + books.length + ' books'}
          onClick={function() { setClearConfirm(true); }}
          danger
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row
          icon={<Info size={16} />}
          label="Expense Tracker"
          sub="v2.0 · All data stored locally on your device"
          right={null}
        />
      </Section>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', paddingBottom: 16 }}>
        Your data never leaves your device.
      </div>

      <ExportWizard
        open={exportWizardOpen}
        onClose={function() { setExportWizardOpen(false); }}
        books={books}
        transactions={transactions}
        currency={settings.currency}
      />

      <BackupRestoreModal
        open={backupOpen}
        onClose={function() { setBackupOpen(false); }}
        userId={user ? user.id : null}
        userEmail={user ? user.email : null}
      />

      <PinSetupModal
        open={!!pinModalMode}
        mode={pinModalMode}
        onClose={function() { setPinModalMode(null); }}
        onSuccess={function() { setPinEnabled(isPinLockEnabled()); }}
      />

      <ClearBookWizard
        open={clearBookOpen}
        onClose={function() { setClearBookOpen(false); }}
        books={books}
        transactions={transactions}
        delBook={delBook}
      />

      <ClearRangeWizard
        open={clearRangeOpen}
        onClose={function() { setClearRangeOpen(false); }}
        books={books}
        transactions={transactions}
        delTxRange={delTxRange}
      />

      <ConfirmDialog
        open={clearConfirm}
        title="Clear All Data?"
        description="This permanently deletes every book, transaction, attached receipt, and app setting on this device. This is the most destructive option in Data Management and cannot be undone."
        confirmLabel="Clear Everything"
        onConfirm={handleClear}
        onCancel={function() { setClearConfirm(false); }}
      />
    </div>
  );
}
