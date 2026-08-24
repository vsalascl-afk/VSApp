/**
 * Offline Database Module
 * Uses IndexedDB to store pending operations and cached data for offline use.
 */

const DB_NAME = "elecdata_offline";
const DB_VERSION = 1;

// Store names
const SYNC_QUEUE_STORE = "sync_queue";
const CACHED_DATA_STORE = "cached_data";

export interface SyncQueueItem {
  id: string;
  timestamp: number;
  type: "checklist_bms" | "orden_trabajo";
  action: "create" | "update";
  payload: Record<string, unknown>;
  url: string;
  method: "POST" | "PATCH";
  headers: Record<string, string>;
  retries: number;
}

export interface CachedDataItem {
  key: string;
  data: unknown;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
        syncStore.createIndex("timestamp", "timestamp", { unique: false });
        syncStore.createIndex("type", "type", { unique: false });
      }

      if (!db.objectStoreNames.contains(CACHED_DATA_STORE)) {
        db.createObjectStore(CACHED_DATA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============ SYNC QUEUE OPERATIONS ============

export async function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): Promise<string> {
  const db = await openDB();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const entry: SyncQueueItem = {
    ...item,
    id,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(entry);
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const index = store.index("timestamp");
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ============ CACHED DATA OPERATIONS ============

export async function cacheData(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  const entry: CachedDataItem = { key, data, timestamp: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHED_DATA_STORE, "readwrite");
    const store = tx.objectStore(CACHED_DATA_STORE);
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHED_DATA_STORE, "readonly");
    const store = tx.objectStore(CACHED_DATA_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result as CachedDataItem | undefined;
      resolve(result ? (result.data as T) : null);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removeCachedData(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHED_DATA_STORE, "readwrite");
    const store = tx.objectStore(CACHED_DATA_STORE);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}