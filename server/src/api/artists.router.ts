import { Router } from "express";
import { fetchAllSavedTracks } from "./spotify-client.js";
import { extractArtists } from "./transform.js";
import { upsertLikedArtists, getCachedLikedArtists } from "../db.js";

export const artistsRouter = Router();

artistsRouter.get("/liked-artists", async (req, res) => {
  try {
    const { accessToken } = req.session.tokens!;
    const savedTracks = await fetchAllSavedTracks(accessToken);
    const artists = extractArtists(savedTracks);

    // Cache for offline use
    upsertLikedArtists(artists);

    res.json({ artists });
  } catch (err) {
    console.error("Error fetching liked artists:", err);

    // Fall back to cached artists
    const cached = getCachedLikedArtists();
    if (cached.length > 0) {
      console.log(`[artists] Serving ${cached.length} cached artists`);
      res.json({ artists: cached });
      return;
    }

    res.status(500).json({ error: "Failed to fetch liked artists" });
  }
});
