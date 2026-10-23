import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { getAnalytics } from "../../services/analyticsApi";
type Snapshot = { data?: unknown; error?: string; loading: boolean };
type Entry = {
  url: string;
  key: string;
  snapshot: Snapshot;
  listeners: Set<() => void>;
  controller?: AbortController;
};

// nik - Keep mutable request state in an external store, scoped to this analytics page visit.
export class AnalyticsStore {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  revision = 0;
  subscribeRevision = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  refresh = () => {
    this.entries.forEach((entry) => entry.controller?.abort());
    this.entries.clear();
    this.revision++;
    this.listeners.forEach((listener) => listener());
  };
  entry(url: string) {
    const key = `${this.revision}:${url}`;
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 40)
        for (const [oldKey, old] of this.entries)
          if (!old.listeners.size) {
            this.entries.delete(oldKey);
            break;
          }
      entry = { url, key, snapshot: { loading: true }, listeners: new Set() };
      this.entries.set(key, entry);
    }
    return entry;
  }
  subscribe(entry: Entry, listener: () => void) {
    entry.listeners.add(listener);
    if (!entry.controller && !entry.snapshot.data && !entry.snapshot.error) {
      const controller = new AbortController();
      entry.controller = controller;
      getAnalytics(entry.url, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            entry.snapshot = { data, loading: false };
            entry.listeners.forEach((notify) => notify());
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            entry.snapshot = {
              error: error instanceof Error ? error.message : "Unable to load report.",
              loading: false,
            };
            entry.listeners.forEach((notify) => notify());
          }
        });
    }
    return () => {
      entry.listeners.delete(listener);
      // nik - Immediate StrictMode resubscriptions reuse a request; abandoned requests are cancelled.
      queueMicrotask(() => {
        if (!entry.listeners.size && entry.snapshot.loading) {
          entry.controller?.abort();
          entry.controller = undefined;
          this.entries.delete(entry.key);
        }
      });
    };
  }
}
export const AnalyticsContext = createContext<AnalyticsStore | null>(null);
export function useAnalyticsRefresh() {
  return useContext(AnalyticsContext)!.refresh;
}
export function useAnalyticsQuery<T>(url: string, enabled = true) {
  const store = useContext(AnalyticsContext)!;
  useSyncExternalStore(store.subscribeRevision, () => store.revision);
  const entry = store.entry(url);
  const subscribe = useCallback(
    (listener: () => void) => (enabled ? store.subscribe(entry, listener) : () => {}),
    [store, entry, enabled],
  );
  const snapshot = useSyncExternalStore(subscribe, () => entry.snapshot);
  return enabled
    ? { ...snapshot, data: snapshot.data as T | undefined }
    : { data: undefined, loading: true, error: undefined };
}
