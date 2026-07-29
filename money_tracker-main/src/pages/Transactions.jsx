import { useState, useMemo } from 'react';
import { Search, X, SlidersHorizontal, ListFilter, Calendar } from 'lucide-react';
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

  var inputStyle = {
    flex: 1, padding: '8px 10px',
    background: 'var(--bg-input)', border: '1px solid var(--border-light)',
    borderRadius: 8, fontSize: 13, color: 'var(--text)', minWidth: 0,
  };

  return (
    <div className="page">
      {/* ── Sticky header with search + filter toggles ── */}
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div className="flex items-center justify-between">
          <span className="page-title">History</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Date range toggle */}
            <button
              className="btn-icon"
              onClick={function() { setShowDate(function(v) { return !v; }); setShowFil(false); }}
              style={{
                background: (showDate || hasDateFil) ? 'var(--accent-dim)' : undefined,
                color: (showDate || hasDateFil) ? 'var(--accent)' : undefined,
              }}>
              <Calendar size={17} />
            </button>
            {/* Category/type filter toggle */}
            <button
              className="btn-icon"
              onClick={function() { setShowFil(function(v) { return !v; }); setShowDate(false); }}
              style={{
                background: (showFil || hasFilter) ? 'var(--accent-dim)' : undefined,
                color: (showFil || hasFilter) ? 'var(--accent)' : undefined,
              }}>
              <SlidersHorizontal size={17} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="search-wrap" style={{ marginBottom: 0 }}>
          <Search className="search-icon" />
          <input
            className="search-input" placeholder="Search…"
            value={search} onChange={function(e) { setSearch(e.target.value); }}
          />
          {search && (
            <button className="search-clear" onClick={function() { setSearch(''); }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Date range panel ── */}
        {showDate && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Presets */}
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Quick Select</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'today',     label: 'Today' },
                  { id: 'thisMonth', label: 'This month' },
                  { id: 'lastMonth', label: 'Last month' },
                  { id: 'thisYear',  label: 'This year' },
                ].map(function(p) {
                  return (
                    <button key={p.id}
                      style={{ padding: '5px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer' }}
                      onClick={function() { applyPreset(p.id); }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* From / To inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date" style={inputStyle}
                value={from} max={to || todayStr()}
                onChange={function(e) { setFrom(e.target.value); }}
                placeholder="From"
              />
              <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>→</span>
              <input
                type="date" style={inputStyle}
                value={to} min={from} max={todayStr()}
                onChange={function(e) { setTo(e.target.value); }}
                placeholder="To"
              />
            </div>

            {hasDateFil && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                  {from || '…'} → {to || 'today'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={clearDates} style={{ padding: '4px 0' }}>
                  <X size={13} /> Clear dates
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Category / type filter panel ── */}
        {showFil && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Type</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TYPES.map(function(f) {
                  return (
                    <button key={f.id} className={chipStyle(typeFil === f.id)}
                      onClick={function() { setTypeFil(f.id); }}>{f.label}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Category</div>
              <div className="filter-row">
                <button className={chipStyle(catFil === 'all')} onClick={function() { setCatFil('all'); }}>All</button>
                {CATEGORIES.map(function(c) {
                  return (
                    <button key={c.id} className={chipStyle(catFil === c.id)}
                      onClick={function() { setCatFil(c.id); }}>{c.label}</button>
                  );
                })}
              </div>
            </div>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm" onClick={function() { setTypeFil('all'); setCatFil('all'); }}
                style={{ alignSelf: 'flex-start', padding: '4px 0' }}>
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Active date range badge ── */}
      {hasDateFil && !showDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8 }}>
          <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--accent)', flex: 1 }}>
            {from || '…'} → {to || 'today'}
          </span>
          <button onClick={clearDates} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', padding: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Income / Expense summary ── */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: 'var(--success-dim)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Income</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>+{fmt(totIncome, cur)}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--danger-dim)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Expenses</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>−{fmt(totExpense, cur)}</div>
          </div>
        </div>
      )}

      {/* ── Transaction list ── */}
      {groups.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><ListFilter size={22} /></div>
          <div className="empty-title">{hasAnyFil ? 'No results' : 'No transactions'}</div>
          <div className="empty-desc">{hasAnyFil ? 'Try adjusting your filters or date range.' : 'Add transactions with the + button.'}</div>
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
                  {dayTotal >= 0 ? '+' : '−'}{fmt(Math.abs(dayTotal), cur)}
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
