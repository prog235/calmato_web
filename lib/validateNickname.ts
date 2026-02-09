const BAD_WORDS = [
  // 예시 — 실제 서비스에서는 점진적으로 늘리세요
  "sex",
  "fuck",
  "shit",
  "ass",
  "porn",
  "pussy",
  "whore",
  "야동",
  "섹스",
  "병신",
  "새끼",
  "시발",
  "느금마",
  "장애인",
  "지랄",
  "보지",
  "자지",
  "존나",
];

function getWeightedLength(nickname: string): number {
  let length = 0;

  for (const ch of nickname) {
    if (/[가-힣]/.test(ch)) {
      length += 1; // 한글 1
    } else if (/[A-Za-z0-9]/.test(ch)) {
      length += 0.5; // 영어/숫자 0.5
    }
  }

  return length;
}

type NicknameValidationResult = {
  valid: boolean;
  message: string;
};

export function validateNickname(raw: string): NicknameValidationResult {
  const nickname = raw.trim();

  // 1. 빈 값
  if (!nickname) {
    return { valid: false, message: "닉네임을 입력해주세요." };
  }

  // 2. 공백 포함 금지
  if (/\s/.test(nickname)) {
    return { valid: false, message: "닉네임에는 공백을 사용할 수 없습니다." };
  }

  // 3. 허용 문자: 한글 음절, 영문, 숫자만
  if (!/^[가-힣A-Za-z0-9]+$/.test(nickname)) {
    return {
      valid: false,
      message: "닉네임에는 한글, 영어, 숫자만 사용할 수 있습니다.",
    };
  }

  // 4. 한글 자모만으로 구성된 경우 차단 (ㅇㅈㅎ 등)
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(nickname)) {
    return {
      valid: false,
      message: "완성된 한글 음절을 사용해주세요.",
    };
  }

  const weightedLength = getWeightedLength(nickname);

  if (weightedLength < 2 || weightedLength > 8) {
    return {
      valid: false,
      message: "닉네임은 2~8글자 범위여야 합니다.",
    };
  }

  // 6. 비속어 / 금지어 필터
  const normalized = nickname.toLowerCase();

  for (const bad of BAD_WORDS) {
    if (normalized.includes(bad)) {
      return {
        valid: false,
        message: "사용할 수 없는 단어가 포함되어 있습니다.",
      };
    }
  }

  return { valid: true, message: "" };
}
