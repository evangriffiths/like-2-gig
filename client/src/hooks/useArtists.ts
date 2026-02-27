import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LikedArtist } from "../types";

export function useArtists() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<LikedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/liked-artists")
      .then((res) => {
        if (res.status === 401) {
          navigate("/", { replace: true });
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data) setArtists(data.artists);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  return { artists, loading, error };
}
