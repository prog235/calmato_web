// pages/project/[slug].tsx
import { GetStaticPaths, GetStaticProps } from "next";
import albums from "@/album.json";
import { useRouter } from "next/router";
import ReactPlayer from "react-player";

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
  youtubeUrl: string;
  tracks: Track[];
}

export default function ProjectDetailPage({ album }: { album: Album }) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <div className="px-8 sm:px-12 md:px-16 mb-16">
      <h1 className="text-3xl font-bold mb-6">{album.title}</h1>

      {/* 전체 영역: 유튜브 + 설명 + 트랙 */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* 왼쪽: 유튜브 + 설명 */}
        <div className="relative aspect-[16/9] w-full max-w-[700px] overflow-hidden rounded-lg card-shadow">
          <ReactPlayer
            src={album.youtubeUrl}
            width="100%"
            height="100%"
            className=""
          />

          <p className="text-gray-400 text-sm leading-relaxed">
            {album.desc_kim}
          </p>
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
