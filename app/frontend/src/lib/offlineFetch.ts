/**
 * Offline-aware fetch wrapper
 * When offline, queues write operations for later sync.
 * For read operations, returns cached data if available.
 */

import { addToSyncQueue } from "./offlineDB";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "./supabase";

interface OfflineFetchOptions {
  type: "checklist_bms" | "orden_trabajo";
  action: "create" | "update";
  payload: Record<string, unknown>;
  url: string;
  method: "POST" | "PATCH";
  token: string;
  useServiceKey?: boolean;
}

export async function offlineSaveFetch(options: OfflineFetchOptions): Promise<{
  success: boolean;
  offline: boolean;
  data?: unknown;
  error?: string;
  queueId?: string;
}> {
  const { type, action, payload, url, method, token, useServiceKey } = options;

  const apiKey = useServiceKey && SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY : SUPABASE_KEY;
  const authToken = useServiceKey && SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY : token;

  const headers: Record<string, string> = {
    apikey: apiKey,
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // If online, try to send directly
  if (navigator.onLine) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, offline: false, data };
      }

      const errText = await response.text();
      // If it's a network issue disguised as error, queue it
      if (response.status >= 500) {
        const queueId = await addToSyncQueue({ type, action, payload, url, method, headers });
        return { success: true, offline: true, queueId };
      }

      return { success: false, offline: false, error: errText };
    } catch {
      // Network error - queue for later
      const queueId = await addToSyncQueue({ type, action, payload, url, method, headers });
      return { success: true, offline: true, queueId };
    }
  }

  // If offline, queue the operation
  const queueId = await addToSyncQueue({ type, action, payload, url, method, headers });
  return { success: true, offline: true, queueId };
}

/**
 * Build Supabase REST URL for a table
 */
export function buildSupabaseUrl(table: string, filters?: string): string {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (filters) url += `?${filters}`;
  return url;
}