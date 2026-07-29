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

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Books</span>
        <button className="btn btn-primary btn-sm" onClick={function() { setEditBook(null); setModalOpen(true); }}>
          <Plus size={15} /> New
        </button>
      </div>

      {books.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><BookOpen size={22} /></div>
          <div className="empty-title">No books yet</div>
          <div className="empty-desc">Create books to organize finances by account.</div>
        </div>
      ) : (
        books.map(function(book) {
          const stats = getStats(book.id);
          const isActive = book.id === activeBookId;
          const BookIcon = (book.iconId && BOOK_ICON_MAP[book.iconId]) ? BOOK_ICON_MAP[book.iconId] : User;
          return (
            <div key={book.id} className={'book-card' + (isActive ? ' active' : '')}
              style={{ borderColor: isActive ? book.color : undefined }}
              onClick={function() { setBook(book.id); }}>
              <div className="book-icon" style={{ background: book.color + '22' }}>
                <BookIcon size={19} strokeWidth={1.8} style={{ color: book.color }} />
              </div>
              <div className="book-info">
                <div className="book-name">
                  {book.name}
                  {isActive && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: book.color, background: book.color + '18', borderRadius: 99, padding: '1px 7px', verticalAlign: 'middle' }}>
                      Active
                    </span>
                  )}
                </div>
                <div className="book-meta">{stats.count} transaction{stats.count !== 1 ? 's' : ''}</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: stats.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {stats.balance >= 0 ? '+' : '−'}{fmt(Math.abs(stats.balance), cur)}
                </div>
              </div>
              <div className="book-actions" onClick={function(e) { e.stopPropagation(); }}>
                <button className="btn-icon" onClick={function() { setEditBook(book); setModalOpen(true); }}>
                  <Pencil size={14} />
                </button>
                <button className="btn-icon" onClick={function() { handleDelete(book); }} style={{ color: '#FF453A' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 20, background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: 12, padding: '13px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0A84FF', marginBottom: 4 }}>Tip</div>
        <div style={{ fontSize: 13, color: '#A1A1AA', lineHeight: 1.5 }}>
          Tap a book to make it active. Create separate books for Personal, Business, or Savings to keep your finances organized.
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
