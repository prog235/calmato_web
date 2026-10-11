import { motion } from "framer-motion";
import Image from "next/image";
import bgText from "@/public/home_text.png";
import { getImage } from "@/lib/getUrl";

const homeImage = getImage("assets", "home.jpg");

export default function Home() {
  return (
    <section className="relative mb-30 h-[82svh] min-h-[560px] w-full overflow-hidden sm:h-[80vh] sm:min-h-0">
      {/* 배경 이미지 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <Image
          src={homeImage}
          alt="Calmato Background"
          fill
          className="object-cover object-center sm:object-top"
          sizes="100vw"
          priority
        />
      </motion.div>
      {/* 중앙 Quote */}
      <motion.div
        className="absolute left-1/2 top-[43%] w-full -translate-x-1/2 -translate-y-1/2 page-gutter sm:top-2/5"
        initial={{ opacity: 0, y: 20 }} // 시작 상태: 투명, 20px 아래
        animate={{ opacity: 1, y: 0 }}  // 끝 상태: 불투명, 제자리
        transition={{ duration: 1, ease: "easeOut" }} // 애니메이션 속도
      >
        <div className="relative mx-auto w-full max-w-[864px] py-5 sm:py-6">
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[150%] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.34)_42%,rgba(0,0,0,0)_74%)] blur-md sm:inset-0 sm:h-auto sm:translate-y-0 sm:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.48)_0%,rgba(0,0,0,0.28)_42%,rgba(0,0,0,0)_72%)]"
            aria-hidden="true"
          />
          <p className="mx-auto block max-w-[350px] text-center text-[20px] font-normal italic leading-[1.22] text-white/60 drop-shadow-[0_3px_16px_rgba(0,0,0,0.68)] sm:hidden">
            <span className="block whitespace-nowrap">May you end your day</span>
            <span className="block whitespace-nowrap">calmly and peacefully.</span>
          </p>
          <Image
            src={bgText}
            alt="bgText"
            width={800}
            height={300}
            className="hidden sm:block sm:h-auto w-full"
          />
        </div>
      </motion.div>


      {/* 하단 Calmato 소개 */}
      <motion.div
        className="absolute bottom-10 flex w-full flex-col items-center space-y-2 page-gutter text-center text-[13px] leading-6 text-gray-200 sm:bottom-12 sm:text-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
      >
        <p className="text-center">
          <span className="font-bold">Calmato</span>는 당신의 마음을 듣는 공간이에요.<br />
          편안하게, 조용히, 그리고 자유롭게 당신의 하루를 나누어주세요.
        </p>
      </motion.div>
    </section>
  );
}
