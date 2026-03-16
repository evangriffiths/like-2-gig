import { Router } from "express";
import { getCachedLikedArtists, getSyncJob } from "../db.js";
import { runSync, isSyncing } from "../sync.js";

export const artistsRouter = Router();

artistsRouter.get("/liked-artists", async (req, res) => {
  const userId = req.session.userId!;
  const artists = getCachedLikedArtists(userId);
  res.json({ artists });
});

artistsRouter.get("/sync-status", async (req, res) => {
  const userId = req.session.userId!;
  const syncJob = getSyncJob(userId);
  res.json({ syncJob });
});

artistsRouter.post("/sync", async (req, res) => {
  const userId = req.session.userId!;

  if (!isSyncing(userId)) {
    // Fire and forget
    runSync(userId);
  }

  // Return current status immediately
  const syncJob = getSyncJob(userId);
  res.json({ syncJob });
});
