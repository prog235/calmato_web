// lib/thumbnail.ts
import { supabase } from "@/lib/supabaseClient";

export const getThumbnailUrl = (path: string | null) => {
  if (!path) return null;

  const { data } = supabase.storage
    .from("thumbnails")
    .getPublicUrl(path);

  return data.publicUrl;
};

export const getAudioUrl = (path: string | null) => {
  if (!path) return null;

  const { data } = supabase.storage
    .from("audio")
    .getPublicUrl(path);

  return data.publicUrl;
};

export const getImage = (bucket: string, path: string) => {

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

    return data.publicUrl;
}
