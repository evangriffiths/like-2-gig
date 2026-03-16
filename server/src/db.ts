import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import type { Gig, ArtistGigs, LikedArtist, LikedSong } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/like2gig.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS artist_gigs (
    spotify_artist_id TEXT NOT NULL PRIMARY KEY,
    artist_name TEXT NOT NULL,
    songkick_path TEXT,
    status TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gigs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spotify_artist_id TEXT NOT NULL REFERENCES artist_gigs(spotify_artist_id),
    venue TEXT NOT NULL,
    location TEXT NOT NULL,
    date TEXT NOT NULL,
    songkick_url TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    UNIQUE(spotify_artist_id, songkick_url)
  );

  CREATE TABLE IF NOT EXISTS liked_artists (
    spotify_artist_id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    first_liked_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS liked_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spotify_artist_id TEXT NOT NULL REFERENCES liked_artists(spotify_artist_id),
    spotify_track_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(spotify_artist_id, spotify_track_id)
  );

  CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    synced_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT
  );
`);

// Migration: seed liked_artists from artist_gigs if empty
{
  const count = (db.prepare("SELECT COUNT(*) as c FROM liked_artists").get() as { c: number }).c;
  if (count === 0) {
    db.exec(`
      INSERT OR IGNORE INTO liked_artists (spotify_artist_id, name, first_liked_at)
      SELECT spotify_artist_id, artist_name, fetched_at FROM artist_gigs
    `);
  }
}

// Migration: add lat/lng columns if missing, mark existing rows stale for re-scrape
const columns = db.prepare("PRAGMA table_info(gigs)").all() as Array<{ name: string }>;
const hasLatitude = columns.some((c) => c.name === "latitude");
if (!hasLatitude) {
  db.exec(`
    ALTER TABLE gigs ADD COLUMN latitude REAL;
    ALTER TABLE gigs ADD COLUMN longitude REAL;
    UPDATE artist_gigs SET fetched_at = '2000-01-01T00:00:00.000Z';
  `);
}

// --- Queries ---

const STALE_OK_HOURS = 24;
const STALE_ERROR_HOURS = 1;

interface ArtistGigRow {
  spotify_artist_id: string;
  artist_name: string;
  songkick_path: string | null;
  status: string;
  fetched_at: string;
}

/**
 * Returns artist IDs that need scraping: either not in DB, or stale.
 */
export function getStaleArtistIds(
  artistIds: string[]
): string[] {
  if (artistIds.length === 0) return [];

  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT spotify_artist_id, status, fetched_at FROM artist_gigs
       WHERE spotify_artist_id IN (${placeholders})`
    )
    .all(...artistIds) as ArtistGigRow[];

  const now = Date.now();
  const fresh = new Set<string>();

  for (const row of rows) {
    const age = now - new Date(row.fetched_at).getTime();
    const maxAge =
      row.status === "error"
        ? STALE_ERROR_HOURS * 3600_000
        : STALE_OK_HOURS * 3600_000;
    if (age < maxAge) {
      fresh.add(row.spotify_artist_id);
    }
  }

  return artistIds.filter((id) => !fresh.has(id));
}

/**
 * Upsert an artist scrape result with its gigs.
 */
export function upsertArtistGigs(
  spotifyArtistId: string,
  artistName: string,
  songkickPath: string | null,
  status: "ok" | "not_found" | "error",
  gigs: Gig[]
): void {
  const txn = db.transaction(() => {
    db.prepare(
      `INSERT INTO artist_gigs (spotify_artist_id, artist_name, songkick_path, status, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(spotify_artist_id) DO UPDATE SET
         artist_name = excluded.artist_name,
         songkick_path = excluded.songkick_path,
         status = excluded.status,
         fetched_at = excluded.fetched_at`
    ).run(spotifyArtistId, artistName, songkickPath, status, new Date().toISOString());

    // Clear old gigs and insert fresh ones
    db.prepare("DELETE FROM gigs WHERE spotify_artist_id = ?").run(spotifyArtistId);

    const insert = db.prepare(
      `INSERT OR IGNORE INTO gigs (spotify_artist_id, venue, location, date, songkick_url, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const gig of gigs) {
      insert.run(spotifyArtistId, gig.venue, gig.location, gig.date, gig.songkickUrl, gig.latitude, gig.longitude);
    }
  });
  txn();
}

/**
 * Get artist names that were not found on Songkick.
 */
export function getNotFoundArtists(artistIds: string[]): string[] {
  if (artistIds.length === 0) return [];
  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT artist_name FROM artist_gigs
       WHERE spotify_artist_id IN (${placeholders}) AND status = 'not_found'
       ORDER BY artist_name`
    )
    .all(...artistIds) as Array<{ artist_name: string }>;
  return rows.map((r) => r.artist_name);
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GigRow {
  spotify_artist_id: string;
  artist_name: string;
  venue: string;
  location: string;
  date: string;
  songkick_url: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LocationFilter {
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * Cache liked artists and their songs from Spotify.
 * Replaces all existing data (full refresh).
 */
export function upsertLikedArtists(artists: LikedArtist[]): void {
  const txn = db.transaction(() => {
    db.exec("DELETE FROM liked_songs");
    db.exec("DELETE FROM liked_artists");

    const insertArtist = db.prepare(
      `INSERT INTO liked_artists (spotify_artist_id, name, first_liked_at)
       VALUES (?, ?, ?)`
    );
    const insertSong = db.prepare(
      `INSERT INTO liked_songs (spotify_artist_id, spotify_track_id, name, added_at)
       VALUES (?, ?, ?, ?)`
    );

    for (const artist of artists) {
      insertArtist.run(artist.id, artist.name, artist.firstLikedAt);
      for (const song of artist.songs) {
        insertSong.run(artist.id, song.id, song.name, song.addedAt);
      }
    }
  });
  txn();
}

/**
 * Get all cached liked artists with their songs.
 */
export function getCachedLikedArtists(): LikedArtist[] {
  const artistRows = db
    .prepare(`SELECT spotify_artist_id, name, first_liked_at FROM liked_artists ORDER BY name`)
    .all() as Array<{ spotify_artist_id: string; name: string; first_liked_at: string }>;

  if (artistRows.length === 0) return [];

  const songRows = db
    .prepare(`SELECT spotify_artist_id, spotify_track_id, name, added_at FROM liked_songs ORDER BY added_at DESC`)
    .all() as Array<{ spotify_artist_id: string; spotify_track_id: string; name: string; added_at: string }>;

  const songsByArtist = new Map<string, LikedSong[]>();
  for (const s of songRows) {
    const list = songsByArtist.get(s.spotify_artist_id) || [];
    list.push({ id: s.spotify_track_id, name: s.name, addedAt: s.added_at });
    songsByArtist.set(s.spotify_artist_id, list);
  }

  return artistRows.map((a) => ({
    id: a.spotify_artist_id,
    name: a.name,
    firstLikedAt: a.first_liked_at,
    songs: songsByArtist.get(a.spotify_artist_id) || [],
  }));
}

/**
 * Get all cached liked artist IDs.
 */
export function getCachedLikedArtistIds(): string[] {
  const rows = db
    .prepare(`SELECT spotify_artist_id FROM liked_artists`)
    .all() as Array<{ spotify_artist_id: string }>;
  return rows.map((r) => r.spotify_artist_id);
}

/**
 * Get cached gigs for a set of artist IDs, optionally filtered by location.
 */
export function getCachedGigs(artistIds: string[], locationFilter?: LocationFilter): ArtistGigs[] {
  if (artistIds.length === 0) return [];

  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT g.spotify_artist_id, ag.artist_name, g.venue, g.location, g.date, g.songkick_url, g.latitude, g.longitude
       FROM gigs g
       JOIN artist_gigs ag ON ag.spotify_artist_id = g.spotify_artist_id
       WHERE g.spotify_artist_id IN (${placeholders})
       ORDER BY g.date, ag.artist_name`
    )
    .all(...artistIds) as GigRow[];

  // Group by artist
  const map = new Map<string, ArtistGigs>();
  for (const row of rows) {
    // Apply location filter if provided
    if (locationFilter) {
      if (row.latitude == null || row.longitude == null) continue;
      const dist = haversineKm(locationFilter.lat, locationFilter.lng, row.latitude, row.longitude);
      if (dist > locationFilter.radiusKm) continue;
    }

    let entry = map.get(row.spotify_artist_id);
    if (!entry) {
      entry = {
        artistId: row.spotify_artist_id,
        artistName: row.artist_name,
        gigs: [],
      };
      map.set(row.spotify_artist_id, entry);
    }
    entry.gigs.push({
      venue: row.venue,
      location: row.location,
      date: row.date,
      songkickUrl: row.songkick_url,
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }

  return Array.from(map.values());
}

// --- Sync status ---

export interface SyncStatus {
  syncedAt: string;
  status: "ok" | "error";
  errorMessage: string | null;
}

export function setSyncStatus(status: "ok" | "error", errorMessage?: string): void {
  db.prepare(
    `INSERT INTO sync_status (id, synced_at, status, error_message)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       synced_at = excluded.synced_at,
       status = excluded.status,
       error_message = excluded.error_message`
  ).run(new Date().toISOString(), status, errorMessage || null);
}

export function getSyncStatus(): SyncStatus | null {
  const row = db
    .prepare(`SELECT synced_at, status, error_message FROM sync_status WHERE id = 1`)
    .get() as { synced_at: string; status: "ok" | "error"; error_message: string | null } | undefined;
  if (!row) return null;
  return { syncedAt: row.synced_at, status: row.status, errorMessage: row.error_message };
}
