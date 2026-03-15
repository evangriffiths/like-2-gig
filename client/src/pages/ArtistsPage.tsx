import { useMemo, useState } from "react";
import { useArtists } from "../hooks/useArtists";
import { SearchBar } from "../components/SearchBar";
import { SortToggle } from "../components/SortToggle";
import { ArtistList } from "../components/ArtistList";
import { Spinner } from "../components/Spinner";
import type { SyncStatus } from "../types";

export type SortField = "alpha" | "firstLiked" | "likes";
export type SortDir = "asc" | "desc";

function SyncIndicator({
  syncStatus,
  syncing,
  onSync,
}: {
  syncStatus: SyncStatus | null;
  syncing: boolean;
  onSync: () => void;
}) {
  let statusText: string;
  let statusColor: string;

  if (!syncStatus) {
    statusText = "Never synced";
    statusColor = "text-gray-500";
  } else {
    const date = new Date(syncStatus.syncedAt);
    const timeStr = date.toLocaleString();
    if (syncStatus.status === "ok") {
      statusText = `Synced ${timeStr}`;
      statusColor = "text-gray-500";
    } else {
      statusText = `Sync failed ${timeStr}`;
      statusColor = "text-amber-500";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            !syncStatus
              ? "bg-gray-500"
              : syncStatus.status === "ok"
                ? "bg-green-500"
                : "bg-amber-500"
          }`}
        />
        <span className={`text-xs ${statusColor}`}>{statusText}</span>
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        className="rounded bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync"}
      </button>
    </div>
  );
}

export function ArtistsPage() {
  const { artists, loading, error, syncStatus, syncing, sync } = useArtists();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("alpha");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    let result = artists.filter((a) =>
      a.name.toLowerCase().includes(query)
    );

    const dir = sortDir === "asc" ? 1 : -1;

    if (sortField === "alpha") {
      result = result.toSorted((a, b) => dir * a.name.localeCompare(b.name));
    } else if (sortField === "firstLiked") {
      result = result.toSorted(
        (a, b) =>
          dir *
          (new Date(a.firstLikedAt).getTime() -
            new Date(b.firstLikedAt).getTime())
      );
    } else {
      result = result.toSorted(
        (a, b) => dir * (a.songs.length - b.songs.length)
      );
    }

    return result;
  }, [artists, search, sortField, sortDir]);

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Your Artists</h1>
          <SyncIndicator syncStatus={syncStatus} syncing={syncing} onSync={sync} />
        </div>

        <div className="mb-4 flex gap-3">
          <SearchBar value={search} onChange={setSearch} />
          <SortToggle sortField={sortField} sortDir={sortDir} onChange={handleSortChange} />
        </div>

        {loading && <Spinner />}
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {!loading && (
          <>
            <p className="mb-3 text-sm text-gray-500">
              {filtered.length} artist{filtered.length !== 1 && "s"}
            </p>
            <ArtistList artists={filtered} />
          </>
        )}
      </div>
    </div>
  );
}
