import { useState, useMemo } from 'react';
import { TrendingDown, TrendingUp, Plus, Minus, Wallet } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { fmt, fmtFull, fmtDate, monthKey, fmtMonth, groupByDate, catBreakdown } from '../utils/constants';
import TransactionItem from '../components/TransactionItem';
import TransactionDetail from '../components/TransactionDetail';
import TransactionModal from '../components/TransactionModal';

export default function Dashboard() {
  var app = useApp();
  var bookTxs = app.bookTxs;
  var activeBook = app.activeBook;
  var settings = app.settings;
  var cur = settings.currency;

  var selTxState = useState(null); var selTx = selTxState[0]; var setSelTx = selTxState[1];
  var editTxState = useState(null); var editTx = editTxState[0]; var setEditTx = editTxState[1];
  var addTypeState = useState(null); var addType = addTypeState[0]; var setAddType = addTypeState[1];

  var thisMonthKey = monthKey(new Date().toISOString());

  var thisMo = useMemo(function() {
    return bookTxs.filter(function(t) { return monthKey(t.date) === thisMonthKey; });
  }, [bookTxs, thisMonthKey]);

  var balance = useMemo(function() {
    return bookTxs.reduce(function(s, t) { return t.type === 'income' ? s + t.amount : s - t.amount; }, 0);
  }, [bookTxs]);

  var moIncome = useMemo(function() {
    return thisMo.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  }, [thisMo]);

  var moExpense = useMemo(function() {
    return thisMo.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  }, [thisMo]);

  var breakdown = useMemo(function() { return catBreakdown(thisMo); }, [thisMo]);
  var maxCat = breakdown.length > 0 ? breakdown[0].total : 1;

  var recentGroups = useMemo(function() {
    var sorted = bookTxs.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 30);
    return groupByDate(sorted);
  }, [bookTxs]);

  var moSavings = moIncome - moExpense;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Overview</div>
      </div>

      {/* ── Hero balance card ── */}
      <div className="dash-hero">
        <div className="dash-hero-book">
          <div className="dash-hero-dot" style={{ background: activeBook ? activeBook.color : 'var(--accent)' }} />
          <span>{activeBook ? activeBook.name : 'My Book'}</span>
        </div>

        <div className="dash-hero-label">Total Balance</div>
        <div className="dash-hero-amount" style={{ color: balance < 0 ? 'var(--danger)' : '#fff' }}>
          {balance < 0 ? '−' : ''}{fmtFull(Math.abs(balance), cur)}
        </div>

        {/* Divider */}
        <div className="dash-hero-divider" />

        {/* 3-col stat row */}
        <div className="dash-stats">
          <div className="dash-stat">
            <div className="dash-stat-pill dash-stat-income">
              <TrendingUp size={10} />
            </div>
            <div className="dash-stat-label">Income</div>
            <div className="dash-stat-val" style={{ color: 'rgba(255,255,255,0.9)' }}>+{fmt(moIncome, cur)}</div>
          </div>
          <div className="dash-stat-sep" />
          <div className="dash-stat">
            <div className="dash-stat-pill dash-stat-expense">
              <TrendingDown size={10} />
            </div>
            <div className="dash-stat-label">Expenses</div>
            <div className="dash-stat-val" style={{ color: 'rgba(255,255,255,0.9)' }}>−{fmt(moExpense, cur)}</div>
          </div>
          <div className="dash-stat-sep" />
          <div className="dash-stat">
            <div className="dash-stat-pill" style={{ background: moSavings >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: moSavings >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {moSavings >= 0 ? '▲' : '▼'}
              </span>
            </div>
            <div className="dash-stat-label">Saved</div>
            <div className="dash-stat-val" style={{ color: moSavings >= 0 ? 'rgba(255,255,255,0.9)' : 'rgba(239,68,68,0.9)' }}>
              {moSavings >= 0 ? '+' : '−'}{fmt(Math.abs(moSavings), cur)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick add buttons ── */}
      <div className="dash-quick">
        <button className="dash-quick-btn dash-quick-income" onClick={function() { setAddType('income'); }} type="button">
          <div className="dash-quick-icon"><Plus size={14} /></div>
          <span>Add Income</span>
        </button>
        <button className="dash-quick-btn dash-quick-expense" onClick={function() { setAddType('expense'); }} type="button">
          <div className="dash-quick-icon"><Minus size={14} /></div>
          <span>Add Expense</span>
        </button>
      </div>

      {/* ── Category Breakdown ── */}
      {breakdown.length > 0 && (
        <>
          <div className="section-hd">
            <span className="section-title">Spending</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtMonth(thisMonthKey)}</span>
          </div>
          <div className="card card-p mb-4">
            <div className="cat-bar-list">
              {breakdown.slice(0, 6).map(function(cat) {
                return (
                  <div key={cat.id} className="cat-bar-row">
                    <div className="cat-bar-icon" style={{ background: cat.bg }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: cat.color }} />
                    </div>
                    <span className="cat-bar-label">{cat.label}</span>
                    <div className="cat-bar-track">
                      <div className="cat-bar-fill" style={{ width: (cat.total / maxCat * 100) + '%', background: cat.color }} />
                    </div>
                    <span className="cat-bar-val">{fmt(cat.total, cur)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Recent Transactions ── */}
      <div className="section-hd">
        <span className="section-title">Recent</span>
      </div>

      {recentGroups.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Wallet size={24} /></div>
          <div className="empty-title">No transactions yet</div>
          <div className="empty-desc">Use the buttons above to add your first transaction.</div>
        </div>
      ) : (
        recentGroups.map(function(entry) {
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
        open={!!editTx || !!addType}
        onClose={function() { setEditTx(null); setAddType(null); }}
        editTx={editTx}
        defaultType={addType}
      />
    </div>
  );
}
