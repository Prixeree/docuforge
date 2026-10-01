const DB_NAME = 'docuforge-cache';
const DB_VERSION = 2;

let dbInstance = null;

export async function initDB() {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('clips')) {
          db.createObjectStore('clips', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tts_cache')) {
          db.createObjectStore('tts_cache', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };
      
      request.onerror = (event) => {
        console.warn('IndexedDB init failed:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB exception during init:', err);
      resolve(null);
    }
  });
}

async function getDB() {
  if (!dbInstance) await initDB();
  return dbInstance;
}

export async function dbGet(storeName, key) {
  const db = await getDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => {
        console.warn(`dbGet error on ${storeName}:`, req.error);
        resolve(null);
      };
    } catch (err) {
      console.warn(`dbGet exception on ${storeName}:`, err);
      resolve(null);
    }
  });
}

export async function dbPut(storeName, key, value) {
  const db = await getDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put({ id: key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`dbPut error on ${storeName}:`, req.error);
        resolve();
      };
    } catch (err) {
      console.warn(`dbPut exception on ${storeName}:`, err);
      resolve();
    }
  });
}

export async function dbDelete(storeName, key) {
  const db = await getDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`dbDelete error on ${storeName}:`, req.error);
        resolve();
      };
    } catch (err) {
      console.warn(`dbDelete exception on ${storeName}:`, err);
      resolve();
    }
  });
}

export async function dbClear(storeName) {
  const db = await getDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`dbClear error on ${storeName}:`, req.error);
        resolve();
      };
    } catch (err) {
      console.warn(`dbClear exception on ${storeName}:`, err);
      resolve();
    }
  });
}

export async function dbGetAll(storeName) {
  const db = await getDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ? req.result.map(r => r.value) : []);
      req.onerror = () => {
        console.warn(`dbGetAll error on ${storeName}:`, req.error);
        resolve([]);
      };
    } catch (err) {
      console.warn(`dbGetAll exception on ${storeName}:`, err);
      resolve([]);
    }
  });
}
