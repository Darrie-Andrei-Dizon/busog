// Local-first storage: every table lives in IndexedDB on the phone and is
// mirrored in memory (T) so screens can read synchronously.
// Portions live inside each food, ingredients inside each recipe, extras
// inside each log entry, and items inside each saved meal. That keeps
// related rows together, which suits IndexedDB better than join tables.

const DB_NAME = 'busog';
const VERSION = 2;

export const STORES = [
  'meta', 'goals', 'foods', 'places', 'recipes',
  'batches', 'logs', 'weights', 'savedMeals', 'activities',
];

export const T = {};
for (const s of STORES) T[s] = [];

let db = null;

function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openStore() {
  try {
    db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of STORES) {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Storage is blocked by another open tab'));
    });
    for (const s of STORES) {
      T[s] = await done(db.transaction(s).objectStore(s).getAll());
    }
    return true;
  } catch (err) {
    console.warn('IndexedDB unavailable, keeping data in memory only', err);
    db = null;
    return false;
  }
}

function upsert(store, obj) {
  const arr = T[store];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
}

export function put(store, obj) {
  upsert(store, obj);
  if (db) db.transaction(store, 'readwrite').objectStore(store).put(obj);
  return obj;
}

export function putMany(store, list) {
  for (const obj of list) upsert(store, obj);
  if (db && list.length) {
    const os = db.transaction(store, 'readwrite').objectStore(store);
    for (const obj of list) os.put(obj);
  }
}

export function remove(store, id) {
  T[store] = T[store].filter((x) => x.id !== id);
  if (db) db.transaction(store, 'readwrite').objectStore(store).delete(id);
}

export async function clearAll() {
  for (const s of STORES) T[s] = [];
  if (!db) return;
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of STORES) tx.objectStore(s).clear();
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
