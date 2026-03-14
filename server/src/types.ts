import "express-session";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
}

export interface SavedTrackItem {
  added_at: string;
  track: SpotifyTrack;
}

export interface SavedTracksResponse {
  items: SavedTrackItem[];
  next: string | null;
  total: number;
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

declare module "express-session" {
  interface SessionData {
    tokens?: TokenSet;
    oauthState?: string;
  }
}
