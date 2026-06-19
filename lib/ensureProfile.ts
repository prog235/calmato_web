import type { User } from "@supabase/supabase-js";

import { DEFAULT_PROFILE_IMAGE_PATH } from "@/lib/profileImages";
import { supabase } from "@/lib/supabaseClient";

type ProfileNicknameRow = {
  id: string;
  nickname: string | null;
  profile_image_path: string | null;
};

function sanitizeNickname(value: string) {
  const nickname = value.replace(/[^가-힣A-Za-z0-9]/g, "");

  if (nickname.length >= 2) return nickname.slice(0, 8);
  if (nickname.length === 1) return `${nickname}user`.slice(0, 8);

  return "user";
}

export function getEmailNicknameFallback(email?: string | null) {
  const [localPart] = (email ?? "").split("@");
  return sanitizeNickname(localPart || "user");
}

function getMetadataString(user: User, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function getOAuthNicknameFallback(user: User) {
  return sanitizeNickname(
    getMetadataString(user, [
      "nickname",
      "name",
      "full_name",
      "preferred_username",
      "user_name",
    ]) || getEmailNicknameFallback(user.email)
  );
}

function getOAuthNickname(user: User) {
  const nickname = getMetadataString(user, [
    "nickname",
    "name",
    "full_name",
    "preferred_username",
    "user_name",
  ]);

  return nickname ? sanitizeNickname(nickname) : "";
}

function getOAuthProfileImagePath(user: User) {
  return getMetadataString(user, [
    "avatar_url",
    "picture",
    "profile_image_url",
    "profile_image",
  ]);
}

function shouldUseOAuthProfileImage(currentPath: string | null | undefined) {
  const path = currentPath?.trim();

  return (
    !path ||
    path === DEFAULT_PROFILE_IMAGE_PATH ||
    path === "default_profile.jpg" ||
    path === "default_profile.jpeg"
  );
}

function isGeneratedNickname(nickname: string | null | undefined) {
  return /^user[_-]?[a-f0-9]{4,}$/i.test(nickname?.trim() ?? "");
}

const MAX_NICKNAME_LENGTH = 8;
const MAX_NICKNAME_SUFFIX = 999;

function getNumberedNickname(base: string, suffixNumber: number) {
  if (suffixNumber === 0) return base;

  const suffix = String(suffixNumber);
  const baseLength = Math.max(1, MAX_NICKNAME_LENGTH - suffix.length);

  return `${base.slice(0, baseLength)}${suffix}`;
}

function getNicknameCandidates(user: User) {
  const base = getOAuthNicknameFallback(user);
  const fallbackSuffix = user.id.replace(/-/g, "").slice(0, 4);
  const candidates = new Set<string>();

  for (let suffixNumber = 0; suffixNumber <= MAX_NICKNAME_SUFFIX; suffixNumber += 1) {
    candidates.add(getNumberedNickname(base, suffixNumber));
  }

  candidates.add(`${base}${fallbackSuffix}`.slice(0, MAX_NICKNAME_LENGTH));
  candidates.add(`user${fallbackSuffix}`.slice(0, MAX_NICKNAME_LENGTH));

  return Array.from(candidates);
}

export async function ensureProfileNicknameFallback(user: User) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nickname, profile_image_path")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.warn("[ensureProfileNicknameFallback] select failed:", profileError);
    return;
  }

  const row = profile as ProfileNicknameRow | null;
  const existingProfileImagePath = row?.profile_image_path ?? null;
  const oauthProfileImagePath = getOAuthProfileImagePath(user);
  const profileImagePath =
    oauthProfileImagePath && shouldUseOAuthProfileImage(existingProfileImagePath)
      ? oauthProfileImagePath
      : existingProfileImagePath?.trim() || DEFAULT_PROFILE_IMAGE_PATH;

  const existingNickname = row?.nickname?.trim() ?? "";
  const shouldUseOAuthNickname = Boolean(
    existingNickname && isGeneratedNickname(existingNickname) && getOAuthNickname(user)
  );

  if (existingNickname && !shouldUseOAuthNickname) {
    if (profileImagePath !== existingProfileImagePath) {
      const { error } = await supabase
        .from("profiles")
        .update({ profile_image_path: profileImagePath })
        .eq("id", user.id);

      if (error) {
        console.warn("[ensureProfileNicknameFallback] image update failed:", error);
      }
    }
    return;
  }

  const candidates = shouldUseOAuthNickname
    ? Array.from(
        new Set([
          ...Array.from({ length: MAX_NICKNAME_SUFFIX + 1 }, (_, suffixNumber) =>
            getNumberedNickname(getOAuthNickname(user), suffixNumber)
          ),
          ...getNicknameCandidates(user),
        ])
      )
    : getNicknameCandidates(user);
  for (const nickname of candidates) {
    const result = row
      ? await supabase
          .from("profiles")
          .update({ nickname, profile_image_path: profileImagePath })
          .eq("id", user.id)
      : await supabase
          .from("profiles")
          .insert({ id: user.id, nickname, profile_image_path: profileImagePath });

    if (!result.error) return;

    if (result.error.code !== "23505") {
      console.warn("[ensureProfileNicknameFallback] write failed:", result.error);
      return;
    }
  }
}
