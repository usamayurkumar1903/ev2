import { getCat, fmtFull } from '../utils/constants';
import { ICONS } from './CategoryIcon';
import { MoreHorizontal, Paperclip } from 'lucide-react';

export default function TransactionItem({ tx, onClick, currency }) {
  if (!currency) currency = '₹';
  var cat  = getCat(tx.category);
  var Icon = ICONS[tx.category] || MoreHorizontal;
  var isExpense = tx.type === 'expense';

  return (
    <div className="tx-item" onClick={function() { if (onClick) onClick(tx); }}>
      {/* Category icon pill */}
      <div className="tx-icon" style={{ background: cat.bg }}>
        <Icon size={18} style={{ color: cat.color }} strokeWidth={1.8} />
      </div>

      {/* Info */}
      <div className="tx-info">
        <div className="tx-title">{tx.notes || cat.label}</div>
        <div className="tx-meta">
          {cat.label}
          {tx.attachment && (
            <span style={{ marginLeft: 5, display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent-light)', fontSize: 10 }}>
              <Paperclip size={9} /> Receipt
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <div className={'tx-amount ' + tx.type}>
          {isExpense ? '−' : '+'}{fmtFull(tx.amount, currency)}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
          background: isExpense ? 'var(--danger-dim)' : 'var(--success-dim)',
          color: isExpense ? 'var(--danger)' : 'var(--success)',
        }}>
          {isExpense ? 'Expense' : 'Income'}
        </div>
      </div>
    </div>
  );
}
