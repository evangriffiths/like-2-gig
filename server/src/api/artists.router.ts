import { Router } from "express";
import { fetchAllSavedTracks } from "./spotify-client.js";
import { extractArtists } from "./transform.js";

export const artistsRouter = Router();

artistsRouter.get("/liked-artists", async (req, res) => {
  try {
    const { accessToken } = req.session.tokens!;
    const savedTracks = await fetchAllSavedTracks(accessToken);
    const artists = extractArtists(savedTracks);
    res.json({ artists });
  } catch (err) {
    console.error("Error fetching liked artists:", err);
    res.status(500).json({ error: "Failed to fetch liked artists" });
  }
});
