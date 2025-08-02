import Image from "next/image";
import { motion } from "framer-motion";

export default function About() {
  const paragraphVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 1.0 + i * 0.4, duration: 0.8 },
    }),
  };

  const paragraphTexts = [
    "Calmato는 이탈리아어로, 악보 위에 “조용히, 고요하게 연주하라”는 뜻의 음악 기호입니다.",
    "",
    "하루의 끝에 조용하고 평화로운 마음을 선물하고자 합니다. 단순한 음악이 아니라, 소리 속에서 고요함을 느낄 수 있도록 하는 하나의 방향성입니다. 말보다 깊고, 침묵보다 따뜻한 소음이 마음속에 조용한 여백이 되기를 바랍니다. 우리는 피아노 건반 사이로 흐르는 감정들을 소리로 엮어, 바람이 머물듯, 햇살이 스치듯 당신의 하루에 닿고 싶습니다.",
    "",
    "세상이 너무 빠르게 돌아갈 때, 잠깐 멈춰도 괜찮다는 위로가 되기를 바랍니다.",
  ];

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      {/* 배경 이미지 슬라이드 */}
      <motion.div
        initial={{ y: "-10%", opacity: 0.5 }}
        animate={{ y: "0%", opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute inset-0 -z-10"
      >
        <Image
          src="/about.jpg"
          alt="Wave background"
          fill
          className="w-full h-full object-cover"
        />
      </motion.div>

      <div className="absolute inset-0 bg-black/40 -z-5" />
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[var(--background)] to-transparent -z-5" />

      {/* 텍스트 영역 */}
      <div className="max-w-3xl mx-auto px-6 pt-40 pb-24 text-center">
        {/* 큰 글씨 애니메이션 */}
        <motion.h2
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 leading-snug"
        >
          당신의 오늘 하루엔<br />
          어떤 소리가 어울릴까요?
        </motion.h2>

        {/* 밑줄 애니메이션 */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
          className="origin-center h-[1px] w-4/5 bg-gradient-to-r from-transparent via-white to-transparent opacity-70 mx-auto"
        />

        {/* 단락별로 내려오는 애니메이션 */}
        <div className="text-sm sm:text-base leading-relaxed text-gray-300 mt-8 text-center space-y-3">
          {paragraphTexts.map((text, i) => (
            <motion.p
              key={i}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={paragraphVariants}
              className={text === "" ? "h-2" : ""}
            >
              {text}
            </motion.p>
          ))}
        </div>
      </div>
    </div>
  );
}
