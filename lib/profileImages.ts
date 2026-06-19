import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_IMAGES_BUCKET = "profile_images";
export const DEFAULT_PROFILE_IMAGE_PATH = "default_profile.png";

export function getProfileImageUrl(
  db: SupabaseClient,
  path: string | null | undefined
) {
  if (path?.startsWith("http://") || path?.startsWith("https://")) {
    return path;
  }

  const { data } = db.storage
    .from(PROFILE_IMAGES_BUCKET)
    .getPublicUrl(path ?? DEFAULT_PROFILE_IMAGE_PATH);

  return data.publicUrl;
}
