import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ArtistGigs } from "../types";

export interface LocationSearch {
  lat: number;
  lng: number;
  radius: number;
}

export function useGigs() {
  const navigate = useNavigate();
  const [artistGigs, setArtistGigs] = useState<ArtistGigs[]>([]);
  const [notFoundArtists, setNotFoundArtists] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationSearch | null>(null);

  const fetchGigs = useCallback(
    async (loc: LocationSearch | null) => {
      setLoading(true);
      setError(null);
      try {
        let url = "/api/gigs";
        if (loc) {
          const params = new URLSearchParams({
            lat: String(loc.lat),
            lng: String(loc.lng),
            radius: String(loc.radius),
          });
          url += `?${params}`;
        }
        const res = await fetch(url);
        if (res.status === 401) {
          navigate("/", { replace: true });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setArtistGigs(data.artistGigs);
        setNotFoundArtists(data.notFoundArtists || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    fetchGigs(location);
  }, [fetchGigs, location]);

  const searchByLocation = useCallback(
    (loc: LocationSearch) => setLocation(loc),
    []
  );

  const clearLocation = useCallback(() => setLocation(null), []);

  return { artistGigs, notFoundArtists, loading, error, searchByLocation, clearLocation, location };
}
