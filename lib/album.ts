// lib/album.ts
import albums from "@/album.json";

export function getAlbumBySlug(slug: string) {
  return albums.find((album) => album.slug === slug);
}
