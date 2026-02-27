import type { LikedArtist } from "../types";
import { ArtistRow } from "./ArtistRow";

interface ArtistListProps {
  artists: LikedArtist[];
}

export function ArtistList({ artists }: ArtistListProps) {
  if (artists.length === 0) {
    return <p className="text-gray-500">No artists found.</p>;
  }

  return (
    <ul className="space-y-1">
      {artists.map((artist) => (
        <ArtistRow key={artist.id} artist={artist} />
      ))}
    </ul>
  );
}
