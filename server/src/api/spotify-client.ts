import type { SavedTrackItem, SavedTracksResponse } from "../types.js";

export async function fetchAllSavedTracks(
  accessToken: string
): Promise<SavedTrackItem[]> {
  const all: SavedTrackItem[] = [];
  let url: string | null =
    "https://api.spotify.com/v1/me/tracks?limit=50&offset=0";

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
      console.log(`Rate limited, retrying after ${retryAfter}s`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Spotify API error (${res.status}): ${await res.text()}`);
    }

    const data: SavedTracksResponse = await res.json();
    all.push(...data.items);
    url = data.next;
  }

  return all;
}
