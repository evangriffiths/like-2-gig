import type { SavedTrackItem, LikedArtist, LikedSong } from "../types.js";

export function extractArtists(savedTracks: SavedTrackItem[]): LikedArtist[] {
  const artistMap = new Map<string, LikedArtist>();

  for (const item of savedTracks) {
    const addedAt = item.added_at;
    const song: LikedSong = { id: item.track.id, name: item.track.name, addedAt };

    for (const artist of item.track.artists) {
      const existing = artistMap.get(artist.id);
      if (existing) {
        existing.songs.push(song);
        if (addedAt < existing.firstLikedAt) {
          existing.firstLikedAt = addedAt;
        }
      } else {
        artistMap.set(artist.id, {
          id: artist.id,
          name: artist.name,
          firstLikedAt: addedAt,
          songs: [song],
        });
      }
    }
  }

  // Sort each artist's songs by addedAt descending (most recent first)
  for (const artist of artistMap.values()) {
    artist.songs.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  return Array.from(artistMap.values());
}
