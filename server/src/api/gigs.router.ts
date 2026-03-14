import { Router } from "express";
import { searchArtist, fetchArtistGigs } from "./songkick.js";
import { getStaleArtistIds, upsertArtistGigs, getCachedGigs, getCachedLikedArtists, type LocationFilter } from "../db.js";
import type { LikedArtist } from "../types.js";

const NOMINATIM_UA = "like2gig/1.0";

export const gigsRouter = Router();

// Mutex: only one scrape loop runs at a time
let scrapeInProgress: Promise<void> | null = null;

async function scrapeStaleArtists(artists: LikedArtist[]): Promise<void> {
  const staleIds = getStaleArtistIds(artists.map((a) => a.id));
  const staleArtists = artists.filter((a) => staleIds.includes(a.id));

  if (staleArtists.length === 0) {
    console.log(`[gigs] All ${artists.length} artists cached`);
    return;
  }

  console.log(
    `[gigs] Scraping ${staleArtists.length} stale artists (${artists.length - staleArtists.length} cached)`
  );

  for (let idx = 0; idx < staleArtists.length; idx++) {
    const artist = staleArtists[idx];
    if (idx > 0) await new Promise((r) => setTimeout(r, 1000));

    try {
      console.log(`[gigs] [${idx + 1}/${staleArtists.length}] "${artist.name}"...`);
      const artistPath = await searchArtist(artist.name);

      if (!artistPath) {
        upsertArtistGigs(artist.id, artist.name, null, "not_found", []);
        continue;
      }

      const gigs = await fetchArtistGigs(artistPath);
      console.log(`[gigs]   → ${gigs.length} gigs`);
      upsertArtistGigs(artist.id, artist.name, artistPath, "ok", gigs);
    } catch (err) {
      const msg = (err as Error).message;
      upsertArtistGigs(artist.id, artist.name, null, "error", []);

      // Stop scraping on rate limit — resume on next request
      if (msg.includes("rate limited")) {
        console.warn(`[gigs] Rate limited, stopping. Will resume on next request.`);
        return;
      }
      console.warn(`[gigs]   → error: ${msg}`);
    }
  }

  console.log(`[gigs] Scraping complete`);
}

gigsRouter.get("/gigs", async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    let locationFilter: LocationFilter | undefined;
    if (lat && lng) {
      locationFilter = {
        lat: Number(lat),
        lng: Number(lng),
        radiusKm: Number(radius) || 50,
      };
    }

    // Use cached liked artists — no Spotify call needed
    const artists = getCachedLikedArtists();
    if (artists.length === 0) {
      res.json({ artistGigs: [] });
      return;
    }

    // Scrape stale artists for gig data
    if (!scrapeInProgress) {
      scrapeInProgress = scrapeStaleArtists(artists).finally(() => {
        scrapeInProgress = null;
      });
    }
    await scrapeInProgress;

    const artistIds = artists.map((a) => a.id);
    const artistGigs = getCachedGigs(artistIds, locationFilter);
    res.json({ artistGigs });
  } catch (err) {
    console.error("Error fetching gigs:", err);
    res.status(500).json({ error: "Failed to fetch gigs" });
  }
});

gigsRouter.get("/geocode", async (req, res) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "Missing q parameter" });
    return;
  }

  try {
    const limit = (req.query.limit as string) || "5";
    const params = new URLSearchParams({ q, format: "json", limit });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "User-Agent": NOMINATIM_UA } }
    );
    const raw = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;

    const results = raw.map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      displayName: r.display_name,
    }));
    res.json({ results });
  } catch (err) {
    console.error("Geocode error:", err);
    res.status(500).json({ error: "Geocode failed" });
  }
});
