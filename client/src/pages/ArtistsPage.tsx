import { useMemo, useState } from "react";
import { useArtists } from "../hooks/useArtists";
import { SearchBar } from "../components/SearchBar";
import { SortToggle } from "../components/SortToggle";
import { ArtistList } from "../components/ArtistList";
import { Spinner } from "../components/Spinner";

export type SortField = "alpha" | "firstLiked" | "likes";
export type SortDir = "asc" | "desc";

export function ArtistsPage() {
  const { artists, loading, error } = useArtists();
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
        <h1 className="mb-6 text-3xl font-bold text-white">Your Artists</h1>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
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
