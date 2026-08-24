/**
 * Sync Manager
 * Handles background synchronization of offline data when connection is restored.
 */

import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncQueueItem,
  getSyncQueueCount,
  type SyncQueueItem,
} from "./offlineDB";

const MAX_RETRIES = 3;

type SyncListener = (pendingCount: number, status: "syncing" | "idle" | "error") => void;

let listeners: SyncListener[] = [];
let isSyncing = false;

export function addSyncListener(listener: SyncListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners(count: number, status: "syncing" | "idle" | "error") {
  listeners.forEach((l) => l(count, status));
}

export async function processSyncQueue(): Promise<{ success: number; failed: number }> {
  if (isSyncing) return { success: 0, failed: 0 };
  if (!navigator.onLine) return { success: 0, failed: 0 };

  isSyncing = true;
  let successCount = 0;
  let failedCount = 0;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      isSyncing = false;
      notifyListeners(0, "idle");
      return { success: 0, failed: 0 };
    }

    notifyListeners(queue.length, "syncing");

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.payload),
        });

        if (response.ok || response.status === 201) {
          await removeFromSyncQueue(item.id);
          successCount++;
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry (bad data)
          console.error(`Sync item ${item.id} failed with ${response.status}, removing from queue`);
          await removeFromSyncQueue(item.id);
          failedCount++;
        } else {
          // Server error - retry later
          await handleRetry(item);
          failedCount++;
        }
      } catch {
        // Network error - retry later
        await handleRetry(item);
        failedCount++;
      }
    }

    const remaining = await getSyncQueueCount();
    notifyListeners(remaining, remaining > 0 ? "error" : "idle");
  } catch (err) {
    console.error("Error processing sync queue:", err);
    const count = await getSyncQueueCount();
    notifyListeners(count, "error");
  } finally {
    isSyncing = false;
  }

  return { success: successCount, failed: failedCount };
}

async function handleRetry(item: SyncQueueItem): Promise<void> {
  if (item.retries >= MAX_RETRIES) {
    console.error(`Sync item ${item.id} exceeded max retries, removing`);
    await removeFromSyncQueue(item.id);
    return;
  }
  await updateSyncQueueItem({ ...item, retries: item.retries + 1 });
}

// Auto-sync when coming back online
export function initAutoSync(): () => void {
  const handleOnline = () => {
    console.log("[SyncManager] Connection restored, processing queue...");
    setTimeout(() => processSyncQueue(), 1000);
  };

  window.addEventListener("online", handleOnline);

  // Also try to sync periodically (every 30s if online)
  const interval = setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  }, 30000);

  // Initial sync attempt
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 2000);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}

export { getSyncQueueCount };