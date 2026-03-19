import type { SortField, SortDir } from "../pages/ArtistsPage";

interface SortToggleProps {
  sortField: SortField;
  sortDir: SortDir;
  onChange: (field: SortField) => void;
}

function Arrow({ dir }: { dir: SortDir }) {
  return <span className="ml-1">{dir === "asc" ? "\u2191" : "\u2193"}</span>;
}

export function SortToggle({ sortField, sortDir, onChange }: SortToggleProps) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-700">
      <button
        onClick={() => onChange("alpha")}
        className={`px-3 py-2 text-xs font-medium transition sm:text-sm ${
          sortField === "alpha"
            ? "bg-green-500 text-black"
            : "bg-gray-900 text-gray-400 hover:text-white"
        }`}
      >
        A–Z{sortField === "alpha" && <Arrow dir={sortDir} />}
      </button>
      <button
        onClick={() => onChange("firstLiked")}
        className={`px-3 py-2 text-xs font-medium transition sm:text-sm ${
          sortField === "firstLiked"
            ? "bg-green-500 text-black"
            : "bg-gray-900 text-gray-400 hover:text-white"
        }`}
      >
        Liked{sortField === "firstLiked" && <Arrow dir={sortDir} />}
      </button>
      <button
        onClick={() => onChange("likes")}
        className={`px-3 py-2 text-xs font-medium transition sm:text-sm ${
          sortField === "likes"
            ? "bg-green-500 text-black"
            : "bg-gray-900 text-gray-400 hover:text-white"
        }`}
      >
        # Likes{sortField === "likes" && <Arrow dir={sortDir} />}
      </button>
    </div>
  );
}
