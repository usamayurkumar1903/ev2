import { useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen, User, Briefcase, Home, Plane, Target, Lightbulb, Star, Lock, Gem, Wallet } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { fmt } from '../utils/constants';
import BookModal from '../components/BookModal';
import ConfirmDialog from '../components/ConfirmDialog';

const BOOK_ICON_MAP = { user: User, briefcase: Briefcase, home: Home, plane: Plane, target: Target, bulb: Lightbulb, star: Star, lock: Lock, gem: Gem, wallet: Wallet };

export default function Books() {
  const { books, transactions, activeBookId, setBook, delBook, settings } = useApp();
  const { toast } = useToast();
  const cur = settings.currency;
  const [modalOpen, setModalOpen]     = useState(false);
  const [editBook, setEditBook]       = useState(null);
  const [confirmBook, setConfirmBook] = useState(null);

  function getStats(bookId) {
    const txs = transactions.filter(function(t) { return t.bookId === bookId; });
    const balance = txs.reduce(function(s, t) { return t.type === 'income' ? s + t.amount : s - t.amount; }, 0);
    return { count: txs.length, balance };
  }

  function handleDelete(book) {
    if (books.length <= 1) { toast("Can't delete the only book", 'error'); return; }
    setConfirmBook(book);
  }

  function confirmDel() {
    delBook(confirmBook.id);
    toast('"' + confirmBook.name + '" deleted', 'success');
    setConfirmBook(null);
  }

  var totalBalance = books.reduce(function(sum, b) { return sum + getStats(b.id).balance; }, 0);

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Books</span>
        <button className="bk-new-btn" onClick={function() { setEditBook(null); setModalOpen(true); }} type="button">
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Summary strip */}
      {books.length > 0 && (
        <div className="bk-summary">
          <div className="bk-summary-item">
            <div className="bk-summary-label">Total Books</div>
            <div className="bk-summary-val">{books.length}</div>
          </div>
          <div className="bk-summary-sep" />
          <div className="bk-summary-item">
            <div className="bk-summary-label">Combined Balance</div>
            <div className="bk-summary-val" style={{ color: totalBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalBalance >= 0 ? '+' : '−'}{fmt(Math.abs(totalBalance), cur)}
            </div>
          </div>
        </div>
      )}

      {books.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><BookOpen size={22} /></div>
          <div className="empty-title">No books yet</div>
          <div className="empty-desc">Create books to organize finances by account.</div>
        </div>
      ) : (
        <div className="bk-list">
          {books.map(function(book) {
            const stats = getStats(book.id);
            const isActive = book.id === activeBookId;
            const BookIcon = (book.iconId && BOOK_ICON_MAP[book.iconId]) ? BOOK_ICON_MAP[book.iconId] : User;
            return (
              <div
                key={book.id}
                className={'bk-row' + (isActive ? ' active' : '')}
                style={isActive ? { '--bk-color': book.color } : undefined}
                onClick={function() { setBook(book.id); }}
              >
                <div className="bk-row-icon" style={{ background: book.color + '20', color: book.color }}>
                  <BookIcon size={22} strokeWidth={1.8} />
                </div>

                <div className="bk-row-body">
                  <div className="bk-row-nametop">
                    <span className="bk-row-name">{book.name}</span>
                    {isActive && <span className="bk-row-badge">ACTIVE</span>}
                  </div>
                  <div className="bk-row-count">{stats.count} transaction{stats.count !== 1 ? 's' : ''}</div>
                  <div className="bk-row-balance" style={{ color: stats.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {stats.balance >= 0 ? '+' : '−'}{fmt(Math.abs(stats.balance), cur)}
                  </div>
                </div>

                <div className="bk-row-actions" onClick={function(e) { e.stopPropagation(); }}>
                  <button className="bk-row-action-btn" onClick={function() { setEditBook(book); setModalOpen(true); }} type="button">
                    <Pencil size={15} />
                  </button>
                  <button className="bk-row-action-btn danger" onClick={function() { handleDelete(book); }} type="button">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add-new row */}
          <button className="bk-row bk-row-add" onClick={function() { setEditBook(null); setModalOpen(true); }} type="button">
            <div className="bk-tile-add-icon"><Plus size={20} strokeWidth={2} /></div>
            <span>New Book</span>
          </button>
        </div>
      )}

      <div className="bk-tip">
        <div className="bk-tip-icon"><BookOpen size={14} /></div>
        <div>
          <div className="bk-tip-title">Tip</div>
          <div className="bk-tip-text">Tap a book to make it active. Create separate books for Personal, Business, or Savings to keep your finances organized.</div>
        </div>
      </div>

      <BookModal open={modalOpen} onClose={function() { setModalOpen(false); setEditBook(null); }} editBook={editBook} />
      <ConfirmDialog
        open={!!confirmBook}
        title={'Delete "' + (confirmBook ? confirmBook.name : '') + '"?'}
        description={'This will permanently delete the book and all ' + (confirmBook ? getStats(confirmBook.id).count : 0) + ' transactions inside it.'}
        confirmLabel="Delete Book"
        onConfirm={confirmDel}
        onCancel={function() { setConfirmBook(null); }}
      />
    </div>
  );
}
