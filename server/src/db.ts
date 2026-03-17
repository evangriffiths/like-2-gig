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
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT NOT NULL PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    refresh_token TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

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
    user_id TEXT NOT NULL,
    spotify_artist_id TEXT NOT NULL,
    name TEXT NOT NULL,
    first_liked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, spotify_artist_id)
  );

  CREATE TABLE IF NOT EXISTS liked_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    spotify_artist_id TEXT NOT NULL,
    spotify_track_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(user_id, spotify_artist_id, spotify_track_id)
  );

  CREATE TABLE IF NOT EXISTS sync_jobs (
    user_id TEXT NOT NULL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',
    started_at TEXT,
    completed_at TEXT,
    artists_total INTEGER DEFAULT 0,
    artists_synced INTEGER DEFAULT 0,
    gigs_total INTEGER DEFAULT 0,
    gigs_synced INTEGER DEFAULT 0,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS notification_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    location_name TEXT NOT NULL,
    radius_km INTEGER NOT NULL DEFAULT 50,
    date_from TEXT,
    date_to TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL,
    gig_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent'
  );
`);

// Migration: add email column to users if missing
{
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
}

// Migration: drop old sync_status table
{
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_status'").all();
  if (tables.length > 0) {
    db.exec("DROP TABLE sync_status");
  }
}

// On startup: reset any stuck syncing jobs (killed by restart)
db.exec(`
  UPDATE sync_jobs SET status = 'failed', error_message = 'Interrupted by server restart',
    completed_at = datetime('now') WHERE status IN ('syncing_artists', 'syncing_gigs')
`);

// Migration: add lat/lng columns if missing
const columns = db.prepare("PRAGMA table_info(gigs)").all() as Array<{ name: string }>;
const hasLatitude = columns.some((c) => c.name === "latitude");
if (!hasLatitude) {
  db.exec(`
    ALTER TABLE gigs ADD COLUMN latitude REAL;
    ALTER TABLE gigs ADD COLUMN longitude REAL;
    UPDATE artist_gigs SET fetched_at = '2000-01-01T00:00:00.000Z';
  `);
}

// --- Users ---

export function upsertUser(userId: string, displayName: string, refreshToken: string, email?: string): void {
  db.prepare(
    `INSERT INTO users (user_id, display_name, email, refresh_token, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       email = COALESCE(excluded.email, users.email),
       refresh_token = excluded.refresh_token`
  ).run(userId, displayName, email || null, refreshToken, new Date().toISOString());
}

export function getUserEmail(userId: string): string | null {
  const row = db.prepare("SELECT email FROM users WHERE user_id = ?").get(userId) as { email: string | null } | undefined;
  return row?.email || null;
}

export function getUserRefreshToken(userId: string): string | null {
  const row = db.prepare("SELECT refresh_token FROM users WHERE user_id = ?").get(userId) as { refresh_token: string } | undefined;
  return row?.refresh_token || null;
}

export function updateUserRefreshToken(userId: string, refreshToken: string): void {
  db.prepare("UPDATE users SET refresh_token = ? WHERE user_id = ?").run(refreshToken, userId);
}

export function getAllUserIds(): string[] {
  const rows = db.prepare("SELECT user_id FROM users").all() as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

// --- Sync jobs ---

export interface SyncJob {
  status: "idle" | "syncing_artists" | "syncing_gigs" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  artistsTotal: number;
  artistsSynced: number;
  gigsTotal: number;
  gigsSynced: number;
  errorMessage: string | null;
}

export function getSyncJob(userId: string): SyncJob | null {
  const row = db.prepare(
    `SELECT status, started_at, completed_at, artists_total, artists_synced,
            gigs_total, gigs_synced, error_message
     FROM sync_jobs WHERE user_id = ?`
  ).get(userId) as {
    status: string; started_at: string | null; completed_at: string | null;
    artists_total: number; artists_synced: number;
    gigs_total: number; gigs_synced: number;
    error_message: string | null;
  } | undefined;
  if (!row) return null;
  return {
    status: row.status as SyncJob["status"],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    artistsTotal: row.artists_total,
    artistsSynced: row.artists_synced,
    gigsTotal: row.gigs_total,
    gigsSynced: row.gigs_synced,
    errorMessage: row.error_message,
  };
}

export function updateSyncJob(userId: string, fields: Partial<{
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  artistsTotal: number;
  artistsSynced: number;
  gigsTotal: number;
  gigsSynced: number;
  errorMessage: string | null;
}>): void {
  // Ensure row exists
  db.prepare(
    `INSERT OR IGNORE INTO sync_jobs (user_id, status) VALUES (?, 'idle')`
  ).run(userId);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.status !== undefined) { sets.push("status = ?"); values.push(fields.status); }
  if (fields.startedAt !== undefined) { sets.push("started_at = ?"); values.push(fields.startedAt); }
  if (fields.completedAt !== undefined) { sets.push("completed_at = ?"); values.push(fields.completedAt); }
  if (fields.artistsTotal !== undefined) { sets.push("artists_total = ?"); values.push(fields.artistsTotal); }
  if (fields.artistsSynced !== undefined) { sets.push("artists_synced = ?"); values.push(fields.artistsSynced); }
  if (fields.gigsTotal !== undefined) { sets.push("gigs_total = ?"); values.push(fields.gigsTotal); }
  if (fields.gigsSynced !== undefined) { sets.push("gigs_synced = ?"); values.push(fields.gigsSynced); }
  if (fields.errorMessage !== undefined) { sets.push("error_message = ?"); values.push(fields.errorMessage); }

  if (sets.length > 0) {
    db.prepare(`UPDATE sync_jobs SET ${sets.join(", ")} WHERE user_id = ?`).run(...values, userId);
  }
}

// --- Artist gig scraping (shared across users) ---

const STALE_OK_HOURS = 24;
const STALE_ERROR_HOURS = 1;

export function getStaleArtistIds(artistIds: string[]): string[] {
  if (artistIds.length === 0) return [];
  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT spotify_artist_id, status, fetched_at FROM artist_gigs
     WHERE spotify_artist_id IN (${placeholders})`
  ).all(...artistIds) as Array<{ spotify_artist_id: string; status: string; fetched_at: string }>;

  const now = Date.now();
  const fresh = new Set<string>();
  for (const row of rows) {
    const age = now - new Date(row.fetched_at).getTime();
    const maxAge = row.status === "error" ? STALE_ERROR_HOURS * 3600_000 : STALE_OK_HOURS * 3600_000;
    if (age < maxAge) fresh.add(row.spotify_artist_id);
  }
  return artistIds.filter((id) => !fresh.has(id));
}

export function upsertArtistGigs(
  spotifyArtistId: string, artistName: string,
  songkickPath: string | null, status: "ok" | "not_found" | "error", gigs: Gig[]
): void {
  const txn = db.transaction(() => {
    db.prepare(
      `INSERT INTO artist_gigs (spotify_artist_id, artist_name, songkick_path, status, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(spotify_artist_id) DO UPDATE SET
         artist_name = excluded.artist_name, songkick_path = excluded.songkick_path,
         status = excluded.status, fetched_at = excluded.fetched_at`
    ).run(spotifyArtistId, artistName, songkickPath, status, new Date().toISOString());

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

export function getNotFoundArtists(artistIds: string[]): string[] {
  if (artistIds.length === 0) return [];
  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT artist_name FROM artist_gigs
     WHERE spotify_artist_id IN (${placeholders}) AND status = 'not_found'
     ORDER BY artist_name`
  ).all(...artistIds) as Array<{ artist_name: string }>;
  return rows.map((r) => r.artist_name);
}

// --- Liked artists (per user) ---

export function upsertLikedArtists(userId: string, artists: LikedArtist[]): void {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM liked_songs WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM liked_artists WHERE user_id = ?").run(userId);

    const insertArtist = db.prepare(
      `INSERT INTO liked_artists (user_id, spotify_artist_id, name, first_liked_at) VALUES (?, ?, ?, ?)`
    );
    const insertSong = db.prepare(
      `INSERT INTO liked_songs (user_id, spotify_artist_id, spotify_track_id, name, added_at) VALUES (?, ?, ?, ?, ?)`
    );
    for (const artist of artists) {
      insertArtist.run(userId, artist.id, artist.name, artist.firstLikedAt);
      for (const song of artist.songs) {
        insertSong.run(userId, artist.id, song.id, song.name, song.addedAt);
      }
    }
  });
  txn();
}

export function getCachedLikedArtists(userId: string): LikedArtist[] {
  const artistRows = db.prepare(
    `SELECT spotify_artist_id, name, first_liked_at FROM liked_artists WHERE user_id = ? ORDER BY name`
  ).all(userId) as Array<{ spotify_artist_id: string; name: string; first_liked_at: string }>;
  if (artistRows.length === 0) return [];

  const placeholders = artistRows.map(() => "?").join(",");
  const songRows = db.prepare(
    `SELECT spotify_artist_id, spotify_track_id, name, added_at FROM liked_songs
     WHERE user_id = ? AND spotify_artist_id IN (${placeholders}) ORDER BY added_at DESC`
  ).all(userId, ...artistRows.map((a) => a.spotify_artist_id)) as Array<{
    spotify_artist_id: string; spotify_track_id: string; name: string; added_at: string;
  }>;

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

// --- Gig queries ---

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LocationFilter {
  lat: number;
  lng: number;
  radiusKm: number;
}

export function getCachedGigs(artistIds: string[], locationFilter?: LocationFilter): ArtistGigs[] {
  if (artistIds.length === 0) return [];
  const placeholders = artistIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT g.spotify_artist_id, ag.artist_name, g.venue, g.location, g.date, g.songkick_url, g.latitude, g.longitude
     FROM gigs g JOIN artist_gigs ag ON ag.spotify_artist_id = g.spotify_artist_id
     WHERE g.spotify_artist_id IN (${placeholders}) ORDER BY g.date, ag.artist_name`
  ).all(...artistIds) as Array<{
    spotify_artist_id: string; artist_name: string; venue: string; location: string;
    date: string; songkick_url: string; latitude: number | null; longitude: number | null;
  }>;

  const map = new Map<string, ArtistGigs>();
  for (const row of rows) {
    if (locationFilter) {
      if (row.latitude == null || row.longitude == null) continue;
      if (haversineKm(locationFilter.lat, locationFilter.lng, row.latitude, row.longitude) > locationFilter.radiusKm) continue;
    }
    let entry = map.get(row.spotify_artist_id);
    if (!entry) {
      entry = { artistId: row.spotify_artist_id, artistName: row.artist_name, gigs: [] };
      map.set(row.spotify_artist_id, entry);
    }
    entry.gigs.push({
      venue: row.venue, location: row.location, date: row.date,
      songkickUrl: row.songkick_url, latitude: row.latitude, longitude: row.longitude,
    });
  }
  return Array.from(map.values());
}

// --- Notification rules ---

export interface NotificationRule {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  locationName: string;
  radiusKm: number;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  lastSentAt: string | null;
  lastGigCount: number | null;
}

export function getNotificationRules(userId: string): NotificationRule[] {
  const rows = db.prepare(
    `SELECT nr.id, nr.label, nr.latitude, nr.longitude, nr.location_name, nr.radius_km,
            nr.date_from, nr.date_to, nr.created_at,
            nl.sent_at AS last_sent_at, nl.gig_count AS last_gig_count
     FROM notification_rules nr
     LEFT JOIN notification_log nl ON nl.id = (
       SELECT id FROM notification_log WHERE rule_id = nr.id ORDER BY sent_at DESC LIMIT 1
     )
     WHERE nr.user_id = ?
     ORDER BY nr.created_at DESC`
  ).all(userId) as Array<{
    id: number; label: string; latitude: number; longitude: number;
    location_name: string; radius_km: number; date_from: string | null;
    date_to: string | null; created_at: string;
    last_sent_at: string | null; last_gig_count: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id, label: r.label,
    latitude: r.latitude, longitude: r.longitude,
    locationName: r.location_name, radiusKm: r.radius_km,
    dateFrom: r.date_from, dateTo: r.date_to,
    createdAt: r.created_at,
    lastSentAt: r.last_sent_at, lastGigCount: r.last_gig_count,
  }));
}

export function createNotificationRule(userId: string, rule: {
  label: string; latitude: number; longitude: number; locationName: string;
  radiusKm: number; dateFrom?: string; dateTo?: string;
}): number {
  const result = db.prepare(
    `INSERT INTO notification_rules (user_id, label, latitude, longitude, location_name, radius_km, date_from, date_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, rule.label, rule.latitude, rule.longitude, rule.locationName,
    rule.radiusKm, rule.dateFrom || null, rule.dateTo || null, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function deleteNotificationRule(userId: string, ruleId: number): boolean {
  const result = db.prepare(
    "DELETE FROM notification_rules WHERE id = ? AND user_id = ?"
  ).run(ruleId, userId);
  return result.changes > 0;
}

export function addNotificationLog(ruleId: number, gigCount: number): void {
  db.prepare(
    "INSERT INTO notification_log (rule_id, sent_at, gig_count, status) VALUES (?, ?, ?, 'sent')"
  ).run(ruleId, new Date().toISOString(), gigCount);
}

/**
 * Get all gig songkick_urls for a user's liked artists.
 * Used to snapshot before sync and detect new gigs.
 */
export function getGigUrlsForUser(userId: string): Set<string> {
  const artistRows = db.prepare(
    "SELECT spotify_artist_id FROM liked_artists WHERE user_id = ?"
  ).all(userId) as Array<{ spotify_artist_id: string }>;
  if (artistRows.length === 0) return new Set();

  const placeholders = artistRows.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT songkick_url FROM gigs WHERE spotify_artist_id IN (${placeholders})`
  ).all(...artistRows.map((r) => r.spotify_artist_id)) as Array<{ songkick_url: string }>;
  return new Set(rows.map((r) => r.songkick_url));
}

/**
 * Get all rules for all users (for post-sync notification evaluation).
 */
export function getAllNotificationRules(): Array<{ userId: string; rules: NotificationRule[] }> {
  const userIds = db.prepare(
    "SELECT DISTINCT user_id FROM notification_rules"
  ).all() as Array<{ user_id: string }>;

  return userIds.map((u) => ({
    userId: u.user_id,
    rules: getNotificationRules(u.user_id),
  }));
}

/**
 * Given a set of gig URLs, get full gig details with artist names.
 */
export function getGigsByUrls(urls: string[]): Array<Gig & { artistName: string }> {
  if (urls.length === 0) return [];
  const placeholders = urls.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT g.venue, g.location, g.date, g.songkick_url, g.latitude, g.longitude, ag.artist_name
     FROM gigs g JOIN artist_gigs ag ON ag.spotify_artist_id = g.spotify_artist_id
     WHERE g.songkick_url IN (${placeholders})
     ORDER BY g.date`
  ).all(...urls) as Array<{
    venue: string; location: string; date: string; songkick_url: string;
    latitude: number | null; longitude: number | null; artist_name: string;
  }>;
  return rows.map((r) => ({
    venue: r.venue, location: r.location, date: r.date,
    songkickUrl: r.songkick_url, latitude: r.latitude, longitude: r.longitude,
    artistName: r.artist_name,
  }));
}
