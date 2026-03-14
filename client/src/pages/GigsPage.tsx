import { useState, useEffect, useRef } from "react";
import { useGigs } from "../hooks/useGigs";
import { Spinner } from "../components/Spinner";
import type { ArtistGigs, Gig } from "../types";

const RADIUS_OPTIONS = [25, 50, 100, 200];

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

function ArtistGigSection({ artist }: { artist: ArtistGigs }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-white">
        {artist.artistName}
      </h2>
      <ul className="space-y-1">
        {artist.gigs.map((gig, i) => (
          <GigRow key={i} gig={gig} showArtist={false} />
        ))}
      </ul>
    </div>
  );
}

function GigRow({ gig, showArtist, artistName }: { gig: Gig; showArtist: boolean; artistName?: string }) {
  return (
    <li className="flex items-center justify-between rounded bg-gray-900 px-3 py-2 text-sm">
      <div>
        {showArtist && artistName && (
          <>
            <span className="font-medium text-white">{artistName}</span>
            <span className="mx-2 text-gray-600">·</span>
          </>
        )}
        <span className="text-gray-300">{gig.venue}</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className="text-gray-400">{gig.location}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{gig.date.split("T")[0]}</span>
        <a
          href={gig.songkickUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-white"
          title="View on Songkick"
        >
          ↗
        </a>
      </div>
    </li>
  );
}

function LocationSearch({
  onSearch,
  onClear,
  isFiltered,
}: {
  onSearch: (lat: number, lng: number, radius: number, displayName: string) => void;
  onClear: () => void;
  isFiltered: boolean;
}) {
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(50);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const selectedRef = useRef<GeoResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipFetchRef = useRef(false);

  // Debounced geocode for autocomplete
  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }

    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.results);
        setShowSuggestions(true);
      } catch {
        // ignore
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = (result: GeoResult) => {
    skipFetchRef.current = true;
    selectedRef.current = result;
    setQuery(result.displayName);
    setDisplayName(result.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(result.lat, result.lng, radius, result.displayName);
  };

  const handleClear = () => {
    setQuery("");
    setDisplayName(null);
    setSuggestions([]);
    onClear();
  };

  return (
    <div className="mb-6 space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1" ref={wrapperRef}>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDisplayName(null);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search by location (e.g. Glasgow)"
            className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-gray-600"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded bg-gray-800 shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onClick={() => selectSuggestion(s)}
                  className="cursor-pointer px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  {s.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
        <select
          value={radius}
          onChange={(e) => {
            const newRadius = Number(e.target.value);
            setRadius(newRadius);
            if (selectedRef.current && isFiltered) {
              const s = selectedRef.current;
              onSearch(s.lat, s.lng, newRadius, s.displayName);
            }
          }}
          className="rounded bg-gray-800 px-2 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-gray-600"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
        {isFiltered && (
          <button
            onClick={handleClear}
            className="rounded bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600"
          >
            Clear
          </button>
        )}
      </div>
      {displayName && isFiltered && (
        <p className="text-sm text-gray-400">
          Showing gigs within {radius} km of {displayName}
        </p>
      )}
    </div>
  );
}

export function GigsPage() {
  const { artistGigs, loading, error, searchByLocation, clearLocation, location } = useGigs();

  const isFiltered = location !== null;

  // For location search, flatten gigs across artists and sort by date
  const flatGigs = isFiltered
    ? artistGigs
        .flatMap((ag) =>
          ag.gigs.map((gig) => ({ ...gig, artistName: ag.artistName }))
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : null;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold text-white">Gigs</h1>

        <LocationSearch
          onSearch={(lat, lng, radius) => searchByLocation({ lat, lng, radius })}
          onClear={clearLocation}
          isFiltered={isFiltered}
        />

        {loading && <Spinner />}
        {error && <p className="text-red-400">Error: {error}</p>}
        {!loading && !error && artistGigs.length === 0 && (
          <p className="text-gray-400">
            {isFiltered ? "No gigs found in this area." : "No upcoming gigs found."}
          </p>
        )}

        {!loading && !error && flatGigs && (
          <ul className="space-y-1">
            {flatGigs.map((gig, i) => (
              <GigRow key={i} gig={gig} showArtist artistName={gig.artistName} />
            ))}
          </ul>
        )}

        {!loading && !error && !flatGigs &&
          artistGigs.map((ag) => (
            <ArtistGigSection key={ag.artistId} artist={ag} />
          ))}
      </div>
    </div>
  );
}
