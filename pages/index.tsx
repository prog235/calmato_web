import { motion } from "framer-motion";
import Image from "next/image";
import bgImage from "@/public/bgImage.jpeg"; 
import bgText from "@/public/home_text.png";

export default function Home() {
  return (
    <section className="relative w-full h-[80vh] overflow-hidden mb-30">
      {/* 배경 이미지 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <Image
          src={bgImage}
          alt="Calmato Background"
          fill
          className="object-top"
          priority
        />
      </motion.div>
      {/* 중앙 Quote */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, y: 20 }} // 시작 상태: 투명, 20px 아래
        animate={{ opacity: 1, y: 0 }}  // 끝 상태: 불투명, 제자리
        transition={{ duration: 1, ease: "easeOut" }} // 애니메이션 속도
      >
        <Image
          src={bgText}
          alt="bgText"
          width={800}
          height={300}
        />
      </motion.div>


      {/* 하단 Calmato 소개 + SNS */}
      <motion.div
        className="absolute bottom-8 w-full flex flex-col items-center space-y-2 text-gray-200 text-center text-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
      >
        <p className="text-center text-sm">
          <span className="font-bold">Calmato</span>는 당신의 마음을 듣는 공간이에요.<br />
          편안하게, 조용히, 그리고 자유롭게 당신의 하루를 나누어주세요.
        </p>
      </motion.div>
    </section>
  );
}