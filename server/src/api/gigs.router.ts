import { Router } from "express";
import { getCachedLikedArtists, getCachedGigs, getNotFoundArtists, type LocationFilter } from "../db.js";

const NOMINATIM_UA = "like2gig/1.0";

export const gigsRouter = Router();

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

    const userId = req.session.userId!;
    const artists = getCachedLikedArtists(userId);
    if (artists.length === 0) {
      res.json({ artistGigs: [], notFoundArtists: [] });
      return;
    }

    const artistIds = artists.map((a) => a.id);
    const artistGigs = getCachedGigs(artistIds, locationFilter);
    const notFoundArtists = getNotFoundArtists(artistIds);
    res.json({ artistGigs, notFoundArtists });
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
