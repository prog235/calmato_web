import Image from "next/image";
import { useEffect, useState } from "react";

import {
  DEFAULT_PROFILE_IMAGE_PATH,
  getProfileImageUrl,
} from "@/lib/profileImages";
import { supabase } from "@/lib/supabaseClient";

type ProfileAvatarProps = {
  imagePath?: string | null;
  alt?: string;
  className: string;
  imageClassName?: string;
  sizes?: string;
};

export default function ProfileAvatar({
  imagePath,
  alt = "프로필 이미지",
  className,
  imageClassName = "object-cover",
  sizes = "20px",
}: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);
  const defaultUrl = getProfileImageUrl(supabase, DEFAULT_PROFILE_IMAGE_PATH);
  const imageUrl = failed
    ? defaultUrl
    : getProfileImageUrl(supabase, imagePath);

  useEffect(() => {
    setFailed(false);
  }, [imagePath]);

  return (
    <div className={`relative overflow-hidden rounded-full bg-white/8 ${className}`}>
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized
        className={`rounded-full ${imageClassName}`}
        onError={() => {
          if (imageUrl !== defaultUrl) {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}
