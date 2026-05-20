export type PlaylistDP = {
  id: string | number;
  title: string;
  slug: string;
  thumbnail_path: string;
  category_id: number;
  track_n: number;
  is_asmr: boolean;
};

export type Track = {
  id: string | number;
  title: string;
  subtitle: string;
  thumbnail_path: string;
  audio_path: string;
  desc_kim: string;
  desc_lee: string;
  category_id: number;
  youtube_url: string;
};

export type TrackDP = {
  id: string | number;
  title: string;
  subtitle: string;
  is_in_pl?: boolean;
}

export type Album = {
  id: string | number; 
  title: string;
  slug: string;
  thumbnail: string;
  desc_kim: string;
  desc_lee: string;
  youtube_url: string;
  tracks: TrackDP[];
}
