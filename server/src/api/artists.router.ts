import { Router } from "express";
import { fetchAllSavedTracks } from "./spotify-client.js";
import { extractArtists } from "./transform.js";
import { upsertLikedArtists, getCachedLikedArtists, getSyncStatus, setSyncStatus } from "../db.js";

export const artistsRouter = Router();

artistsRouter.get("/liked-artists", async (req, res) => {
  const userId = req.session.userId!;
  const artists = getCachedLikedArtists(userId);
  res.json({ artists });
});

artistsRouter.get("/sync-status", async (req, res) => {
  const userId = req.session.userId!;
  const status = getSyncStatus(userId);
  res.json({ syncStatus: status });
});

artistsRouter.post("/sync", async (req, res) => {
  const userId = req.session.userId!;
  try {
    const { accessToken } = req.session.tokens!;
    const savedTracks = await fetchAllSavedTracks(accessToken);
    const artists = extractArtists(savedTracks);
    upsertLikedArtists(userId, artists);
    setSyncStatus(userId, "ok");
    res.json({ artists, syncStatus: getSyncStatus(userId) });
  } catch (err) {
    const msg = (err as Error).message;
    console.error("Sync error:", msg);
    setSyncStatus(userId, "error", msg);
    res.status(500).json({ error: msg, syncStatus: getSyncStatus(userId) });
  }
});
