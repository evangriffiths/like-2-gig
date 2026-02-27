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
