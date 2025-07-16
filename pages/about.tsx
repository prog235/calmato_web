import Image from "next/image";

export default function About() {
  return (
    <main className="flex flex-col items-center min-h-screen px-4 text-left">

      {/* 바다 이미지 */}
      <div className="max-w-2xl w-full aspect-video relative">
        <Image
          src="/about.jpg" 
          alt="Calmato Sea"
          fill
          priority
        />
      </div>

      {/* 소개 텍스트 */}
      <div className="max-w-2xl space-y-4 text-sm sm:text-base mt-10">
        <p>
          <span className="font-bold">Calmato</span>는 이탈리아어로, 
          악보 위에 “조용히, 고요하게 연주하라”는 뜻의 음악 기호입니다.
        </p>
        <p>
          이는 “하루의 끝에 조용하고 평화로운 마음을 선물하고 싶다”는 저희의 바람과 완벽히 맞닿아 있습니다. 
          Calmato는 단순히 &apos;조용한 음악&apos;을 뜻하는 것이 아니라, 
          &apos;소리로 표현된 고요함&apos;을 체험할 수 있도록 하는 하나의 방향성입니다.
        </p>
        <p>
          세상이 너무 빠르게 돌아갈 때, 당신에게 잠깐 멈춰도 괜찮다는 위로가 되기를 바랍니다.
        </p>
      </div>
    </main>
  );
}
