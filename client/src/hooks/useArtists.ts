import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { LikedArtist, SyncStatus } from "../types";

export function useArtists() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<LikedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Load cached artists + sync status on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/liked-artists").then((res) => {
        if (res.status === 401) { navigate("/", { replace: true }); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      fetch("/api/sync-status").then((res) => {
        if (!res.ok) return null;
        return res.json();
      }),
    ])
      .then(([artistData, statusData]) => {
        if (artistData) setArtists(artistData.artists);
        if (statusData) setSyncStatus(statusData.syncStatus);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.syncStatus) setSyncStatus(data.syncStatus);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setArtists(data.artists);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, []);

  return { artists, loading, error, syncStatus, syncing, sync };
}
