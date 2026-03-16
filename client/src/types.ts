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
