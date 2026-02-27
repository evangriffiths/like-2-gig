import { useState } from "react";
import type { LikedArtist } from "../types";
import { SpotifyLink } from "./SpotifyLink";

interface ArtistRowProps {
  artist: LikedArtist;
}

export function ArtistRow({ artist }: ArtistRowProps) {
  const [open, setOpen] = useState(false);
  const likedDate = new Date(artist.firstLikedAt).toLocaleDateString();

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center justify-between rounded-lg bg-gray-900 px-4 py-3 text-left transition hover:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xs text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
            >
              &#9654;
            </span>
            <span className="font-medium text-white">{artist.name}</span>
            <span className="text-xs text-gray-600">
              {artist.songs.length}
            </span>
          </div>
          <span className="text-sm text-gray-500">{likedDate}</span>
        </button>
        <SpotifyLink type="artist" id={artist.id} />
      </div>
      {open && (
        <ul className="mb-1 ml-8 mt-1 space-y-0.5">
          {artist.songs.map((song) => (
            <li
              key={song.id}
              className="flex items-center justify-between rounded px-3 py-1.5 text-sm"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-gray-300">{song.name}</span>
                <SpotifyLink type="track" id={song.id} />
              </div>
              <span className="text-xs text-gray-600">
                {new Date(song.addedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
