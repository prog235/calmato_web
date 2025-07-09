//import { motion } from "framer-motion";
import Image from "next/image";
import bgImage from "@/public/bgImage.jpg"; 
import Iconset from "@/components/Iconset";

export default function Home() {
  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* 배경 이미지 */}
      <Image
        src={bgImage}
        alt="Calmato Background"
        fill
        className="object-cover object-center"
        priority
      />

      {/* 중앙 Quote */}
      <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
        <p className="text-xl md:text-2xl lg:text-3xl text-gray-200 drop-shadow">
          &quot;May you end your day calmly and peacefully.&quot;
        </p>
      </div>

      {/* 하단 Calmato 소개 + SNS */}
      <div className="absolute bottom-8 w-full flex flex-col items-center space-y-2  text-gray-200">
        <p className="text-center text-sm">
          <span className="font-bold">Calmato</span>는 당신의 마음을 듣는 공간이에요.<br />
          편안하게, 조용히, 그리고 자유롭게 당신의 하루를 나누어주세요.
        </p>
        <Iconset />
      </div>
    </section>
  );
}