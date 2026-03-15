import { Router } from "express";
import { fetchAllSavedTracks } from "./spotify-client.js";
import { extractArtists } from "./transform.js";
import { upsertLikedArtists, getCachedLikedArtists, getSyncStatus, setSyncStatus } from "../db.js";

export const artistsRouter = Router();

artistsRouter.get("/liked-artists", async (_req, res) => {
  const artists = getCachedLikedArtists();
  res.json({ artists });
});

artistsRouter.get("/sync-status", async (_req, res) => {
  const status = getSyncStatus();
  res.json({ syncStatus: status });
});

artistsRouter.post("/sync", async (req, res) => {
  try {
    const { accessToken } = req.session.tokens!;
    const savedTracks = await fetchAllSavedTracks(accessToken);
    const artists = extractArtists(savedTracks);
    upsertLikedArtists(artists);
    setSyncStatus("ok");
    res.json({ artists, syncStatus: getSyncStatus() });
  } catch (err) {
    const msg = (err as Error).message;
    console.error("Sync error:", msg);
    setSyncStatus("error", msg);
    res.status(500).json({ error: msg, syncStatus: getSyncStatus() });
  }
});
