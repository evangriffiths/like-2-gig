export interface LikedSong {
  id: string;
  name: string;
  addedAt: string;
}

export interface LikedArtist {
  id: string;
  name: string;
  firstLikedAt: string;
  songs: LikedSong[];
}

export interface Gig {
  venue: string;
  location: string;
  date: string;
  songkickUrl: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ArtistGigs {
  artistId: string;
  artistName: string;
  gigs: Gig[];
}

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
