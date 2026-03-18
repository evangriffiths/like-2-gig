import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { SyncJob } from "../types";

interface SyncContextValue {
  syncJob: SyncJob | null;
  isActive: boolean;
  startSync: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  syncJob: null,
  isActive: false,
  startSync: () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [polling, setPolling] = useState(false);

  // Fetch initial sync status, auto-sync if never synced
  useEffect(() => {
    fetch("/api/sync-status")
      .then((res) => res.json())
      .then((data) => {
        setSyncJob(data.syncJob);
        if (data.syncJob?.status === "syncing_artists" || data.syncJob?.status === "syncing_gigs") {
          setPolling(true);
        } else if (!data.syncJob) {
          // Never synced — trigger automatically
          fetch("/api/sync", { method: "POST" })
            .then((r) => r.json())
            .then((d) => { setSyncJob(d.syncJob); setPolling(true); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Poll while sync is active
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/sync-status");
        const data = await res.json();
        setSyncJob(data.syncJob);
        const s = data.syncJob?.status;
        if (!s || s === "completed" || s === "failed" || s === "idle") {
          setPolling(false);
        }
      } catch {
        setPolling(false);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [polling]);

  const startSync = useCallback(async () => {
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setSyncJob(data.syncJob);
      setPolling(true);
    } catch {}
  }, []);

  const isActive = syncJob?.status === "syncing_artists" || syncJob?.status === "syncing_gigs";

  return (
    <SyncContext.Provider value={{ syncJob, isActive, startSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  return useContext(SyncContext);
}
