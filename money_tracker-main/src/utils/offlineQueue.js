/**
 * Offline Queue
 *
 * When a Supabase call fails because the user is offline, we push the
 * intended operation here.  When connectivity is restored we replay the
 * queue in order.
 *
 * Shape of each item:
 * {
 *   id       : string            // random, for dedup / logging
 *   op       : 'upsert' | 'delete'
 *   table    : 'books' | 'transactions' | 'user_profiles'
 *   payload  : object            // row to upsert, or { id } for delete
 *   createdAt: ISO string
 * }
 */

var QUEUE_KEY = 'et-offline-queue';

function load() {
  try {
    var raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function persist(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {}
}

export function enqueue(item) {
  var queue = load();
  // If same table+id already queued, replace to avoid duplicate writes
  var idx = queue.findIndex(function (q) {
    return q.table === item.table && q.payload && q.payload.id === (item.payload && item.payload.id);
  });
  var entry = Object.assign({ id: Math.random().toString(36).slice(2), createdAt: new Date().toISOString() }, item);
  if (idx >= 0 && item.op !== 'delete') {
    queue[idx] = entry;   // replace stale upsert with fresh one
  } else {
    queue.push(entry);
  }
  persist(queue);
}

export function getQueue() {
  return load();
}

export function clearQueue() {
  persist([]);
}

export function removeFromQueue(entryId) {
  var queue = load().filter(function (q) { return q.id !== entryId; });
  persist(queue);
}

/**
 * Attempt to replay all queued operations.
 * `supabase` is injected to avoid a circular import.
 * Returns { succeeded, failed }.
 */
export async function flushQueue(supabase, userId) {
  var queue = load();
  if (!queue.length) return { succeeded: 0, failed: 0 };

  var succeeded = 0;
  var failed    = 0;

  for (var entry of queue) {
    try {
      if (entry.op === 'delete') {
        var { error } = await supabase
          .from(entry.table)
          .delete()
          .eq('id', entry.payload.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        var { error: err } = await supabase
          .from(entry.table)
          .upsert(Object.assign({}, entry.payload, { user_id: userId }), { onConflict: 'id' });
        if (err) throw err;
      }
      removeFromQueue(entry.id);
      succeeded++;
    } catch (e) {
      failed++;
      // Keep in queue — will retry next time
    }
  }

  return { succeeded, failed };
}
