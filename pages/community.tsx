import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function Request() {
  return (
    <div>
      <Link href="/board/free">
        <div className="block relative w-full h-[40vh] overflow-hidden mb-10 group">
          {/* 배경 이미지 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <Image
              src={"/thumbnails/ghibli/totoro.jpg"}
              alt="Free Background"
              fill
              className="object-top object-cover"
              priority
            />
          </motion.div>
            <div className="absolute left-0 top-0 h-full w-[800px] bg-gradient-to-r 
                      from-black to-transparent opacity-70"
            />

          {/* 텍스트 영역 */}
          <motion.div
            className="absolute top-1/2 left-30 transform -translate-y-1/2 z-10 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-4xl font-bold relative inline-block 
              after:content-[''] after:block after:w-[500px] after:h-[2px] 
              after:bg-gradient-to-r
              after:from-white after:to-transparent after:mt-3 after:rounded-full">
              자유게시판
              <span className="text-base font-normal ml-6 align-baseline opacity-90">Bulletin Board</span>
            </h1>
            <p className="text-sm text-shadow-2xs mt-5 opacity-80">
              어떤 말이라도 좋아요. 이곳은 당신의 여백이니까요.
            </p>
          </motion.div>
        </div>
      </Link>

        
      <Link href="/board/free">
        <div className="block relative w-full h-[40vh] overflow-hidden mb-10 group">
          {/* 배경 이미지 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <Image
              src={"/thumbnails/disney/moana.jpg"}
              alt="Request Background"
              fill
              className="object-top object-cover"
              priority
            />
          </motion.div>
          <div className="absolute left-0 top-0 h-full w-[800px] bg-gradient-to-r 
                      from-black to-transparent opacity-70"
          />

          {/* 텍스트 영역 */}
          <motion.div
            className="absolute top-1/2 left-30 transform -translate-y-1/2 z-10 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
          >
            <h1 className="text-4xl font-bold relative inline-block 
              after:content-[''] after:block after:w-[500px] after:h-[2px] 
              after:bg-gradient-to-r
              after:from-white after:to-transparent after:mt-3 after:rounded-full">
              곡 신청
              <span className="text-base font-normal ml-6 align-baseline opacity-90">Track Request</span>
            </h1>
            <p className="text-sm text-shadow mt-5 opacity-80">
              원하시는 곡과 분위기를 자유롭게 신청하세요.
            </p>
          </motion.div>
        </div>
      </Link>
    </div>
    
  );
}