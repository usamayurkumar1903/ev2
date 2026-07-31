import { useState, useMemo } from 'react';
import { Search, X, SlidersHorizontal, ListFilter, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { CATEGORIES, getCat, fmt, fmtDate, groupByDate } from '../utils/constants';
import TransactionItem from '../components/TransactionItem';
import TransactionDetail from '../components/TransactionDetail';
import TransactionModal from '../components/TransactionModal';

var TYPES = [
  { id: 'all',     label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income',  label: 'Income' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Transactions() {
  var app     = useApp();
  var bookTxs = app.bookTxs;
  var cur     = app.settings.currency;

  var searchS    = useState('');   var search   = searchS[0];   var setSearch   = searchS[1];
  var typeS      = useState('all');var typeFil  = typeS[0];    var setTypeFil  = typeS[1];
  var catS       = useState('all');var catFil   = catS[0];     var setCatFil   = catS[1];
  var fromS      = useState('');   var from     = fromS[0];    var setFrom     = fromS[1];
  var toS        = useState('');   var to       = toS[0];      var setTo       = toS[1];
  var selTxS     = useState(null); var selTx    = selTxS[0];   var setSelTx    = selTxS[1];
  var editTxS    = useState(null); var editTx   = editTxS[0];  var setEditTx   = editTxS[1];
  var showFilS   = useState(false);var showFil  = showFilS[0]; var setShowFil  = showFilS[1];
  var showDateS  = useState(false);var showDate = showDateS[0];var setShowDate = showDateS[1];

  var filtered = useMemo(function() {
    return bookTxs.filter(function(t) {
      if (typeFil !== 'all' && t.type !== typeFil) return false;
      if (catFil  !== 'all' && t.category !== catFil) return false;
      if (from && t.date < from) return false;
      if (to   && t.date > to)   return false;
      if (search) {
        var q = search.toLowerCase();
        var cat = getCat(t.category);
        if (!(t.notes || '').toLowerCase().includes(q) && !cat.label.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [bookTxs, typeFil, catFil, from, to, search]);

  var groups = useMemo(function() { return groupByDate(filtered); }, [filtered]);

  var totIncome = useMemo(function() {
    return filtered.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  }, [filtered]);

  var totExpense = useMemo(function() {
    return filtered.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  }, [filtered]);

  var hasFilter   = typeFil !== 'all' || catFil !== 'all';
  var hasDateFil  = !!(from || to);
  var hasAnyFil   = hasFilter || hasDateFil || !!search;

  function clearAll() { setTypeFil('all'); setCatFil('all'); setSearch(''); setFrom(''); setTo(''); }
  function clearDates() { setFrom(''); setTo(''); }

  function applyPreset(preset) {
    var now = new Date();
    if (preset === 'today') {
      setFrom(todayStr()); setTo(todayStr());
    } else if (preset === 'thisMonth') {
      setFrom(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01');
      setTo(todayStr());
    } else if (preset === 'lastMonth') {
      var lm    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(lm.getFullYear() + '-' + String(lm.getMonth() + 1).padStart(2, '0') + '-01');
      setTo(lmEnd.getFullYear() + '-' + String(lmEnd.getMonth() + 1).padStart(2, '0') + '-' + String(lmEnd.getDate()).padStart(2, '0'));
    } else if (preset === 'thisYear') {
      setFrom(now.getFullYear() + '-01-01'); setTo(todayStr());
    }
  }

  var chipStyle = function(active) {
    return 'chip' + (active ? ' active' : '');
  };

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">History</span>
      </div>

      {/* ── Net summary banner ── */}
      <div className="hist-banner">
        <div className="hist-banner-row">
          <div className="hist-banner-stat">
            <div className="hist-banner-icon income"><ArrowUpRight size={14} /></div>
            <div>
              <div className="hist-banner-label">Income</div>
              <div className="hist-banner-val income">{fmt(totIncome, cur)}</div>
            </div>
          </div>
          <div className="hist-banner-stat">
            <div className="hist-banner-icon expense"><ArrowDownRight size={14} /></div>
            <div>
              <div className="hist-banner-label">Expenses</div>
              <div className="hist-banner-val expense">{fmt(totExpense, cur)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + toggle pills ── */}
      <div className="hist-toolbar">
        <div className="hist-search-wrap">
          <Search size={15} className="hist-search-icon" />
          <input
            className="hist-search-input" placeholder="Search transactions…"
            value={search} onChange={function(e) { setSearch(e.target.value); }}
          />
          {search && (
            <button className="hist-search-clear" onClick={function() { setSearch(''); }} type="button">
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          className={'hist-pill-btn' + ((showDate || hasDateFil) ? ' active' : '')}
          onClick={function() { setShowDate(function(v) { return !v; }); setShowFil(false); }}
        >
          <Calendar size={16} />
        </button>
        <button
          type="button"
          className={'hist-pill-btn' + ((showFil || hasFilter) ? ' active' : '')}
          onClick={function() { setShowFil(function(v) { return !v; }); setShowDate(false); }}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* ── Date range panel ── */}
      {showDate && (
        <div className="hist-panel">
          <div className="form-label" style={{ marginBottom: 8 }}>Quick Select</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { id: 'today',     label: 'Today' },
              { id: 'thisMonth', label: 'This month' },
              { id: 'lastMonth', label: 'Last month' },
              { id: 'thisYear',  label: 'This year' },
            ].map(function(p) {
              return (
                <button key={p.id} className="hist-preset-btn" onClick={function() { applyPreset(p.id); }} type="button">
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date" className="hist-date-input"
              value={from} max={to || todayStr()}
              onChange={function(e) { setFrom(e.target.value); }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>→</span>
            <input
              type="date" className="hist-date-input"
              value={to} min={from} max={todayStr()}
              onChange={function(e) { setTo(e.target.value); }}
            />
          </div>

          {hasDateFil && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>
                {from || '…'} → {to || 'today'}
              </span>
              <button className="hist-clear-link" onClick={clearDates} type="button">
                <X size={13} /> Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Category / type filter panel ── */}
      {showFil && (
        <div className="hist-panel">
          <div className="form-label" style={{ marginBottom: 8 }}>Type</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {TYPES.map(function(f) {
              return (
                <button key={f.id} className={chipStyle(typeFil === f.id)}
                  onClick={function() { setTypeFil(f.id); }}>{f.label}</button>
              );
            })}
          </div>
          <div className="form-label" style={{ marginBottom: 8 }}>Category</div>
          <div className="filter-row">
            <button className={chipStyle(catFil === 'all')} onClick={function() { setCatFil('all'); }}>All</button>
            {CATEGORIES.map(function(c) {
              return (
                <button key={c.id} className={chipStyle(catFil === c.id)}
                  onClick={function() { setCatFil(c.id); }}>{c.label}</button>
              );
            })}
          </div>
          {hasFilter && (
            <button className="hist-clear-link" onClick={function() { setTypeFil('all'); setCatFil('all'); }}
              style={{ marginTop: 12 }} type="button">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Active date range badge ── */}
      {hasDateFil && !showDate && (
        <div className="hist-active-badge">
          <Calendar size={13} />
          <span>{from || '…'} → {to || 'today'}</span>
          <button onClick={clearDates} type="button"><X size={13} /></button>
        </div>
      )}

      {/* ── Transaction list ── */}
      {groups.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><ListFilter size={22} /></div>
          <div className="empty-title">{hasAnyFil ? 'No transactions found' : 'No transactions'}</div>
          <div className="empty-desc">{hasAnyFil ? 'No transactions found in the given date range.' : 'Add transactions with the + button.'}</div>
          {hasAnyFil && <button className="btn btn-secondary btn-sm mt-3" onClick={clearAll}>Clear all filters</button>}
        </div>
      ) : (
        groups.map(function(entry) {
          var date = entry[0]; var txs = entry[1];
          var dayTotal = txs.reduce(function(s, t) { return t.type === 'expense' ? s - t.amount : s + t.amount; }, 0);
          return (
            <div key={date}>
              <div className="date-group-hd">
                <span>{fmtDate(date)}</span>
                <span className={'date-group-total ' + (dayTotal >= 0 ? 'text-success' : 'text-danger')}>
                  {fmt(Math.abs(dayTotal), cur)}
                </span>
              </div>
              <div className="tx-list">
                {txs.map(function(tx) {
                  return <TransactionItem key={tx.id} tx={tx} onClick={setSelTx} currency={cur} />;
                })}
              </div>
            </div>
          );
        })
      )}

      <TransactionDetail
        tx={selTx}
        onClose={function() { setSelTx(null); }}
        onEdit={function(tx) { setSelTx(null); setEditTx(tx); }}
      />
      <TransactionModal
        open={!!editTx}
        onClose={function() { setEditTx(null); }}
        editTx={editTx}
      />
    </div>
  );
}
