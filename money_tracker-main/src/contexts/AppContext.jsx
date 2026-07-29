import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { deleteAttachment, deleteAttachments } from '../utils/db';
import {
  upsertBook, deleteBook,
  upsertTransaction, deleteTransaction,
  deleteTransactionsByBook, deleteTransactionsByRange,
  upsertProfile,
  fetchBooks, fetchTransactions, fetchProfile,
  migrateLocalData,
} from '../utils/dataService';

var KEY = 'et-v2';

var DEFAULTS = {
  books: [
    { id: 'personal', name: 'Personal', color: '#0A84FF', iconId: 'user',      createdAt: new Date().toISOString() },
    { id: 'business', name: 'Business', color: '#30D158', iconId: 'briefcase', createdAt: new Date().toISOString() },
  ],
  transactions: [],
  activeBookId: 'personal',
  settings: { currency: '₹', theme: 'dark' },
};

function load() {
  try {
    var s = localStorage.getItem(KEY);
    if (!s) return DEFAULTS;
    var parsed = JSON.parse(s);
    if (!parsed.settings)       parsed.settings = DEFAULTS.settings;
    if (!parsed.settings.theme) parsed.settings.theme = 'dark';
    return Object.assign({}, DEFAULTS, parsed);
  } catch (e) { return DEFAULTS; }
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TX': {
      var tx = Object.assign({ id: uuidv4(), createdAt: new Date().toISOString() }, action.payload);
      return Object.assign({}, state, { transactions: [tx].concat(state.transactions) });
    }
    case 'UPD_TX':
      return Object.assign({}, state, {
        transactions: state.transactions.map(function (t) {
          return t.id === action.payload.id ? Object.assign({}, t, action.payload) : t;
        }),
      });
    case 'DEL_TX':
      return Object.assign({}, state, {
        transactions: state.transactions.filter(function (t) { return t.id !== action.payload; }),
      });
    case 'ADD_BOOK': {
      var book = Object.assign({ id: uuidv4(), createdAt: new Date().toISOString() }, action.payload);
      return Object.assign({}, state, { books: state.books.concat([book]), activeBookId: book.id });
    }
    case 'UPD_BOOK':
      return Object.assign({}, state, {
        books: state.books.map(function (b) {
          return b.id === action.payload.id ? Object.assign({}, b, action.payload) : b;
        }),
      });
    case 'DEL_BOOK': {
      var books = state.books.filter(function (b) { return b.id !== action.payload; });
      var transactions = state.transactions.filter(function (t) { return t.bookId !== action.payload; });
      var activeBookId = state.activeBookId === action.payload
        ? (books[0] ? books[0].id : null) : state.activeBookId;
      return Object.assign({}, state, { books, transactions, activeBookId });
    }
    case 'DEL_TX_RANGE': {
      var p = action.payload;
      return Object.assign({}, state, {
        transactions: state.transactions.filter(function (t) {
          if (t.bookId !== p.bookId) return true;
          if (p.from && t.date < p.from) return true;
          if (p.to   && t.date > p.to)   return true;
          return false;
        }),
      });
    }
    case 'SET_BOOK':     return Object.assign({}, state, { activeBookId: action.payload });
    case 'SET_CURRENCY': return Object.assign({}, state, { settings: Object.assign({}, state.settings, { currency: action.payload }) });
    case 'SET_THEME':    return Object.assign({}, state, { settings: Object.assign({}, state.settings, { theme: action.payload }) });
    case 'HYDRATE':      return Object.assign({}, action.payload);
    // Reset to defaults (used when switching users)
    case 'RESET':        return Object.assign({}, DEFAULTS);
    default:             return state;
  }
}

var Ctx = createContext(null);

export function AppProvider({ children, userId }) {
  var result   = useReducer(reducer, null, load);
  var state    = result[0];
  var dispatch = result[1];

  var stateRef    = useRef(state);
  var userIdRef   = useRef(userId);
  var prevUserRef = useRef(null);   // track previous userId to detect user switch

  useEffect(function () { stateRef.current  = state;  }, [state]);
  useEffect(function () { userIdRef.current = userId; }, [userId]);

  // Persist to localStorage
  useEffect(function () { save(state); }, [state]);

  // Apply theme
  useEffect(function () {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  // ── Load from Supabase when user logs in / changes ──────────
  useEffect(function () {
    if (!userId) return;

    // ── SECURITY: different user logged in → wipe local state ──
    if (prevUserRef.current && prevUserRef.current !== userId) {
      dispatch({ type: 'RESET' });
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
    prevUserRef.current = userId;

    async function loadRemote() {
      var [remoteBooks, remoteTxs, profile] = await Promise.all([
        fetchBooks(userId),
        fetchTransactions(userId),
        fetchProfile(userId),
      ]);

      // Network error — keep whatever is in local state
      if (remoteBooks === null) return;

      // Supabase is empty — upload local data up to the cloud
      if (remoteBooks.length === 0) {
        var local = stateRef.current;
        if (local.books.length > 0 || local.transactions.length > 0) {
          migrateLocalData(userId, local.books, local.transactions).catch(function () {});
        }
        if (profile) {
          dispatch({ type: 'SET_CURRENCY', payload: profile.currency || local.settings.currency });
          dispatch({ type: 'SET_THEME',    payload: profile.theme    || local.settings.theme });
        }
        return;
      }

      // Remote has data — use it as source of truth
      dispatch({
        type: 'HYDRATE',
        payload: Object.assign({}, stateRef.current, {
          books       : remoteBooks,
          transactions: remoteTxs || [],
          settings    : profile
            ? Object.assign({}, stateRef.current.settings, {
                currency: profile.currency || stateRef.current.settings.currency,
                theme   : profile.theme    || stateRef.current.settings.theme,
              })
            : stateRef.current.settings,
        }),
      });
    }

    loadRemote().catch(function () {});
  }, [userId]);

  // ── Mutations ────────────────────────────────────────────────

  var addTx = useCallback(function (d) {
    var id = d.id || uuidv4();
    var tx = Object.assign({ id, createdAt: new Date().toISOString() }, d);
    dispatch({ type: 'ADD_TX', payload: tx });
    var uid = userIdRef.current;
    if (uid) upsertTransaction(uid, tx).catch(function () {});
  }, []);

  var updTx = useCallback(function (d) {
    dispatch({ type: 'UPD_TX', payload: d });
    var uid = userIdRef.current;
    if (uid) {
      var updated = Object.assign(
        {},
        stateRef.current.transactions.find(function (t) { return t.id === d.id; }),
        d
      );
      upsertTransaction(uid, updated).catch(function () {});
    }
  }, []);

  var delTx = useCallback(function (id) {
    dispatch({ type: 'DEL_TX', payload: id });
    deleteAttachment(id).catch(function () {});
    var uid = userIdRef.current;
    if (uid) deleteTransaction(uid, id).catch(function () {});
  }, []);

  var addBook = useCallback(function (d) {
    var id = d.id || uuidv4();
    var book = Object.assign({ id, createdAt: new Date().toISOString() }, d);
    dispatch({ type: 'ADD_BOOK', payload: book });
    var uid = userIdRef.current;
    if (uid) upsertBook(uid, book).catch(function () {});
  }, []);

  var updBook = useCallback(function (d) {
    dispatch({ type: 'UPD_BOOK', payload: d });
    var uid = userIdRef.current;
    if (uid) {
      var updated = Object.assign(
        {},
        stateRef.current.books.find(function (b) { return b.id === d.id; }),
        d
      );
      upsertBook(uid, updated).catch(function () {});
    }
  }, []);

  var delBook = useCallback(function (id) {
    var affectedIds = stateRef.current.transactions
      .filter(function (t) { return t.bookId === id; })
      .map(function (t) { return t.id; });
    dispatch({ type: 'DEL_BOOK', payload: id });
    if (affectedIds.length) deleteAttachments(affectedIds).catch(function () {});
    var uid = userIdRef.current;
    if (uid) {
      deleteTransactionsByBook(uid, id).catch(function () {});
      deleteBook(uid, id).catch(function () {});
    }
  }, []);

  var delTxRange = useCallback(function (bookId, from, to) {
    var affectedIds = stateRef.current.transactions.filter(function (t) {
      if (t.bookId !== bookId) return false;
      if (from && t.date < from) return false;
      if (to   && t.date > to)   return false;
      return true;
    }).map(function (t) { return t.id; });
    dispatch({ type: 'DEL_TX_RANGE', payload: { bookId, from, to } });
    if (affectedIds.length) deleteAttachments(affectedIds).catch(function () {});
    var uid = userIdRef.current;
    if (uid) deleteTransactionsByRange(uid, bookId, from, to).catch(function () {});
    return affectedIds.length;
  }, []);

  var setBook = useCallback(function (id) { dispatch({ type: 'SET_BOOK', payload: id }); }, []);

  var setCurrency = useCallback(function (c) {
    dispatch({ type: 'SET_CURRENCY', payload: c });
    var uid = userIdRef.current;
    if (uid) upsertProfile(uid, { currency: c }).catch(function () {});
  }, []);

  var setTheme = useCallback(function (t) {
    dispatch({ type: 'SET_THEME', payload: t });
    var uid = userIdRef.current;
    if (uid) upsertProfile(uid, { theme: t }).catch(function () {});
  }, []);

  var activeBook = state.books.find(function (b) { return b.id === state.activeBookId; }) || state.books[0];
  var bookTxs    = state.transactions.filter(function (t) { return t.bookId === state.activeBookId; });

  return (
    <Ctx.Provider value={Object.assign({}, state, {
      activeBook, bookTxs,
      addTx, updTx, delTx,
      addBook, updBook, delBook, setBook,
      delTxRange,
      setCurrency, setTheme,
      userId,
    })}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  var c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
