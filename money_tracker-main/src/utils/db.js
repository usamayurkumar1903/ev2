/*
 * Minimal IndexedDB wrapper for storing transaction receipt attachments.
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage is synchronous, string-only, and capped around 5MB total —
 *     completely unsuitable for storing image blobs.
 *   - IndexedDB stores Blobs natively, is async (won't block the UI thread),
 *     and has a much larger storage quota (browser-dependent, but typically
 *     hundreds of MB+). It also works fully offline, same as localStorage.
 *
 * Schema:
 *   DB:    'et-attachments' (v1)
 *   Store: 'attachments', keyPath 'txId' (one attachment per transaction)
 *   Record shape: { txId, blob, mime, name, updatedAt }
 *
 * No external dependency is used — this relies entirely on the native
 * `indexedDB` API already built into every modern browser.
 */

var DB_NAME = 'et-attachments';
var DB_VERSION = 1;
var STORE = 'attachments';

var dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(function (resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'txId' });
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
  return dbPromise;
}

/** Save (or replace) the attachment for a given transaction id. */
export function saveAttachment(txId, file) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({
        txId: txId,
        blob: file,
        mime: file.type,
        name: file.name,
        updatedAt: Date.now(),
      });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/** Get the stored attachment record for a transaction id, or null. */
export function getAttachment(txId) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).get(txId);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

/** Delete the attachment for a single transaction id (no-op if none exists). */
export function deleteAttachment(txId) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(txId);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/** Delete attachments for a batch of transaction ids (used when a book — and all its transactions — is deleted). */
export function deleteAttachments(txIds) {
  if (!txIds || !txIds.length) return Promise.resolve(true);
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      var store = tx.objectStore(STORE);
      txIds.forEach(function (id) { store.delete(id); });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/** Wipe every stored attachment (used by "Clear All Data" in Settings). */
export function clearAllAttachments() {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/** Fetch ALL stored attachment records (used for backup export). */
export function getAllAttachments() {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

/**
 * Bulk-write attachment records during a restore.
 * Each record in `records` must have { txId, blob, mime, name, updatedAt }.
 */
export function restoreAttachments(records) {
  if (!records || !records.length) return Promise.resolve(true);
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      var store = tx.objectStore(STORE);
      records.forEach(function (r) { store.put(r); });
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

/**
 * Smart-merge attachments from a backup:
 *  - txId not in DB → add it
 *  - txId already in DB → keep the record with the newer updatedAt
 *  - Never deletes existing attachments
 */
export function mergeAttachments(records) {
  if (!records || !records.length) return Promise.resolve(true);
  return records.reduce(function (chain, rec) {
    return chain.then(function () {
      return getAttachment(rec.txId).then(function (existing) {
        var needsWrite = !existing ||
          (rec.updatedAt && existing.updatedAt && rec.updatedAt > existing.updatedAt) ||
          (rec.updatedAt && !existing.updatedAt);
        if (!needsWrite) return Promise.resolve();
        return openDB().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(rec);
            tx.oncomplete = function () { resolve(); };
            tx.onerror   = function () { reject(tx.error); };
          });
        });
      }).catch(function () { return Promise.resolve(); });
    });
  }, Promise.resolve());
}
