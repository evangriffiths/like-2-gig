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

export interface SyncStatus {
  syncedAt: string;
  status: "ok" | "error";
  errorMessage: string | null;
}
