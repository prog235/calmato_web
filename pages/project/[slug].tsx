import { GetStaticPaths, GetStaticProps } from "next";
import albums from "@/album.json";
import { useRouter } from "next/router";
import ReactPlayer from "react-player";
import DescriptionSection from "@/components/Description";
import { motion } from "framer-motion";

interface Track {
  title: string;
  movie: string;
  thumbnail: string;
  url: string;
}

interface Album {
  title: string;
  slug: string;
  thumbnail: string;
  desc_kim: string;
  desc_lee: string;
  youtubeUrl: string;
  tracks: Track[];
}

export default function ProjectDetailPage({ album }: { album: Album }) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 2.0, ease: "easeOut" }}
      className="min-h-screen pb-24"
    >
      <div className="px-8 sm:px-12 md:px-16 mb-16">
        <h1 className="text-3xl font-bold mb-6">{album.title}</h1>

        {/* 전체 영역: 유튜브 + 설명 + 트랙 */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* 왼쪽: 유튜브 + 설명 */}
          <div className="flex flex-col gap-6 w-full max-w-[700px]">
            {/* 유튜브 플레이어 */}
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg card-shadow">
              <ReactPlayer
                src={album.youtubeUrl}
                width="100%"
                height="100%"
                className=""
              />
            </div>

            {/* 설명 섹션 */}
            <DescriptionSection
              desc_kim={album.desc_kim}
              desc_lee={album.desc_lee}
            />
          </div>

          {/* 오른쪽: 트랙 리스트 */}
          <div className="flex-1 w-full min-w-[500px] space-y-3">
            {album.tracks.map((track, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-4 border-b border-[var(--foreground)]/10 pb-3"
              >
                {/* 왼쪽 번호 + 제목/영문 */}
                <div className="flex items-center gap-2">
                  <span className="text-md text-gray-400 w-14 text-center">{index + 1}</span>
                  <div>
                    <h3 className="text-base font-semibold">{track.title}</h3>
                    <p className="text-sm subtext">{track.movie}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>  
      </div>
    </motion.div>  
  )
  
};

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = albums.map((album) => ({
    params: { slug: album.slug },
  }));

  return {
    paths,
    fallback: true, // or 'blocking'
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const album = albums.find((a) => a.slug === params?.slug);

  if (!album) {
    return { notFound: true };
  }

  return {
    props: {
      album,
    },
  };
};
