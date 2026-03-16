import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { LikedArtist } from "../types";
import { useSyncContext } from "../contexts/SyncContext";

export function useArtists() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<LikedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { syncJob } = useSyncContext();

  const fetchArtists = useCallback(async () => {
    try {
      const res = await fetch("/api/liked-artists");
      if (res.status === 401) { navigate("/", { replace: true }); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArtists(data.artists);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initial fetch
  useEffect(() => { fetchArtists(); }, [fetchArtists]);

  // Re-fetch when sync completes
  useEffect(() => {
    if (syncJob?.status === "completed") {
      fetchArtists();
    }
  }, [syncJob?.completedAt, fetchArtists]);

  return { artists, loading, error };
}
