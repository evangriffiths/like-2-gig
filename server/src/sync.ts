import { refreshAccessToken } from "./auth/spotify-auth.js";
import { fetchAllSavedTracks } from "./api/spotify-client.js";
import { extractArtists } from "./api/transform.js";
import { searchArtist, fetchArtistGigs } from "./api/songkick.js";
import {
  getUserRefreshToken, updateUserRefreshToken,
  upsertLikedArtists, getCachedLikedArtists,
  getStaleArtistIds, upsertArtistGigs,
  updateSyncJob, getGigUrlsForUser,
} from "./db.js";
import { evaluateNotifications } from "./notifications.js";

const activeSyncs = new Set<string>();

export function isSyncing(userId: string): boolean {
  return activeSyncs.has(userId);
}

export async function runSync(userId: string): Promise<void> {
  if (activeSyncs.has(userId)) return;
  activeSyncs.add(userId);

  try {
    // Phase 1: Sync artists from Spotify
    updateSyncJob(userId, {
      status: "syncing_artists",
      startedAt: new Date().toISOString(),
      completedAt: null,
      artistsTotal: 0, artistsSynced: 0,
      gigsTotal: 0, gigsSynced: 0,
      errorMessage: null,
    });

    const refreshToken = getUserRefreshToken(userId);
    if (!refreshToken) throw new Error("No refresh token found");

    const tokens = await refreshAccessToken(refreshToken);
    updateUserRefreshToken(userId, tokens.refreshToken);

    const savedTracks = await fetchAllSavedTracks(tokens.accessToken);
    const artists = extractArtists(savedTracks);
    upsertLikedArtists(userId, artists);

    updateSyncJob(userId, {
      artistsTotal: artists.length,
      artistsSynced: artists.length,
    });

    // Snapshot gig URLs before scraping to detect new ones
    const gigUrlsBefore = getGigUrlsForUser(userId);

    // Phase 2: Scrape stale gigs
    const allArtistIds = artists.map((a) => a.id);
    const staleIds = getStaleArtistIds(allArtistIds);
    const staleArtists = artists.filter((a) => staleIds.includes(a.id));

    updateSyncJob(userId, {
      status: "syncing_gigs",
      gigsTotal: staleArtists.length,
      gigsSynced: 0,
    });

    console.log(`[sync] ${userId}: ${staleArtists.length} stale artists to scrape`);

    for (let i = 0; i < staleArtists.length; i++) {
      const artist = staleArtists[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));

      try {
        const artistPath = await searchArtist(artist.name);
        if (!artistPath) {
          upsertArtistGigs(artist.id, artist.name, null, "not_found", []);
        } else {
          const gigs = await fetchArtistGigs(artistPath);
          upsertArtistGigs(artist.id, artist.name, artistPath, "ok", gigs);
        }
      } catch (err) {
        const msg = (err as Error).message;
        upsertArtistGigs(artist.id, artist.name, null, "error", []);
        if (msg.includes("rate limited")) {
          console.warn(`[sync] Rate limited at ${i + 1}/${staleArtists.length}, stopping early`);
          updateSyncJob(userId, { gigsSynced: i + 1 });
          break;
        }
      }

      updateSyncJob(userId, { gigsSynced: i + 1 });
    }

    updateSyncJob(userId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    console.log(`[sync] ${userId}: completed`);

    // Evaluate notifications for new gigs
    const gigUrlsAfter = getGigUrlsForUser(userId);
    const newGigUrls = [...gigUrlsAfter].filter((url) => !gigUrlsBefore.has(url));
    if (newGigUrls.length > 0) {
      console.log(`[sync] ${userId}: ${newGigUrls.length} new gigs found, evaluating notifications`);
      await evaluateNotifications(userId, newGigUrls);
    }
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[sync] ${userId}: failed:`, msg);
    updateSyncJob(userId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: msg,
    });
  } finally {
    activeSyncs.delete(userId);
  }
}
