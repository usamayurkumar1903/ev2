/**
 * Supabase data services — books, transactions, user_profiles.
 *
 * Every write is attempted against Supabase first.  If the call throws
 * (network error / offline), it is queued to offlineQueue for replay.
 * All read paths fall back to the in-memory state managed by AppContext,
 * so the UI never blocks waiting for the network.
 */

import { supabase } from './supabase';
import { enqueue }  from './offlineQueue';

/* ── helpers ─────────────────────────────────────────────────── */

function isOfflineError(err) {
  if (!err) return false;
  var msg = (err.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    !navigator.onLine
  );
}

async function attempt(table, op, payload, userId) {
  try {
    await runOnce(table, op, payload, userId);
  } catch (e) {
    // A transaction can be added within milliseconds of its book being
    // created — if the book's own upsert hasn't finished landing on
    // Supabase yet, the transaction insert fails with a foreign-key
    // violation (book_id not found yet), even though it's not a real
    // problem — the book is on its way. Retry once, shortly, before
    // falling back to the slow offline queue.
    if (isForeignKeyError(e)) {
      await new Promise(function (r) { setTimeout(r, 1200); });
      try {
        await runOnce(table, op, payload, userId);
        return;
      } catch (e2) {
        enqueue({ op, table, payload: Object.assign({}, payload, { user_id: userId }) });
        return;
      }
    }
    // Queue for later whether offline or another transient error
    enqueue({ op, table, payload: Object.assign({}, payload, { user_id: userId }) });
  }
}

function isForeignKeyError(e) {
  return !!e && (e.code === '23503' || /foreign key/i.test(e.message || ''));
}

async function runOnce(table, op, payload, userId) {
  if (op === 'delete') {
    var { error } = await supabase
      .from(table)
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    var { error: err } = await supabase
      .from(table)
      .upsert(Object.assign({}, payload, { user_id: userId }), { onConflict: 'id' });
    if (err) throw err;
  }
}

/* ── user_profiles ───────────────────────────────────────────── */

export async function fetchProfile(userId) {
  var { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertProfile(userId, patch) {
  var payload = Object.assign({ id: userId }, patch);
  var { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' });
  if (error) enqueue({ op: 'upsert', table: 'user_profiles', payload });
}

/* ── books ───────────────────────────────────────────────────── */

export async function fetchBooks(userId) {
  var { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return null;
  // Map snake_case → camelCase for the UI
  return data.map(dbBookToLocal);
}

export async function upsertBook(userId, book) {
  var row = localBookToDb(book, userId);
  await attempt('books', 'upsert', row, userId);
}

export async function deleteBook(userId, bookId) {
  await attempt('books', 'delete', { id: bookId }, userId);
}

/* ── transactions ────────────────────────────────────────────── */

export async function fetchTransactions(userId) {
  var { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) return null;
  return data.map(dbTxToLocal);
}

export async function upsertTransaction(userId, tx) {
  var row = localTxToDb(tx, userId);
  await attempt('transactions', 'upsert', row, userId);
}

export async function deleteTransaction(userId, txId) {
  await attempt('transactions', 'delete', { id: txId }, userId);
}

export async function deleteTransactionsByBook(userId, bookId) {
  try {
    var { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('book_id', bookId);
    if (error) throw error;
  } catch (e) {
    // Retry later — this bulk delete must actually reach Supabase, or the
    // transactions reappear on other devices next time they hydrate.
    enqueue({ op: 'delete_by_book', table: 'transactions', payload: { book_id: bookId, user_id: userId } });
  }
}

export async function deleteTransactionsByRange(userId, bookId, from, to) {
  try {
    var q = supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('book_id', bookId);
    if (from) q = q.gte('date', from);
    if (to)   q = q.lte('date', to);
    var { error } = await q;
    if (error) throw error;
  } catch (e) {
    enqueue({ op: 'delete_by_range', table: 'transactions', payload: { book_id: bookId, user_id: userId, from: from || null, to: to || null } });
  }
}

/**
 * Wipe every book/transaction this user owns — used by "Clear All Data".
 * Deleting books cascades transactions server-side, but both are deleted
 * explicitly here in case cascade is ever changed.
 */
export async function clearAllUserData(userId) {
  await supabase.from('transactions').delete().eq('user_id', userId);
  await supabase.from('books').delete().eq('user_id', userId);
}

/* ── Bulk migration  ─────────────────────────────────────────── */
/**
 * Push all local data to Supabase in one batch.
 * Used during first-login migration.
 */
export async function migrateLocalData(userId, books, transactions) {
  // Books first (transactions FK → books)
  if (books.length) {
    var bookRows = books.map(function (b) { return localBookToDb(b, userId); });
    var { error: bErr } = await supabase
      .from('books')
      .upsert(bookRows, { onConflict: 'id' });
    if (bErr) throw bErr;
  }

  if (transactions.length) {
    // Supabase upsert in chunks of 500 to avoid request size limits
    var chunk = 500;
    for (var i = 0; i < transactions.length; i += chunk) {
      var slice = transactions.slice(i, i + chunk).map(function (t) { return localTxToDb(t, userId); });
      var { error: tErr } = await supabase
        .from('transactions')
        .upsert(slice, { onConflict: 'id' });
      if (tErr) throw tErr;
    }
  }
}

/* ── field mapping ───────────────────────────────────────────── */

function localBookToDb(b, userId) {
  return {
    id        : b.id,
    user_id   : userId,
    name      : b.name,
    color     : b.color,
    icon_id   : b.iconId || 'book',
    created_at: b.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function dbBookToLocal(r) {
  return {
    id       : r.id,
    name     : r.name,
    color    : r.color,
    iconId   : r.icon_id,
    createdAt: r.created_at,
  };
}

function localTxToDb(t, userId) {
  return {
    id        : t.id,
    user_id   : userId,
    book_id   : t.bookId,
    type      : t.type,
    amount    : t.amount,
    category  : t.category,
    date      : t.date,
    notes     : t.notes || null,
    attachment: !!t.attachment,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function dbTxToLocal(r) {
  return {
    id        : r.id,
    bookId    : r.book_id,
    type      : r.type,
    amount    : parseFloat(r.amount),
    category  : r.category,
    date      : r.date,
    notes     : r.notes || '',
    attachment: r.attachment,
    createdAt : r.created_at,
  };
}
