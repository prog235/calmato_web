"use client";
const API = process.env.NEXT_PUBLIC_API_URL;

import { useEffect, useState } from "react";

export default function ApiCheck() {
  const [message, setMessage] = useState("확인 중...");

  useEffect(() => {
    const fetchApi = async () => {
      try {
        const res = await fetch(`${API}/`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const text = await res.text(); // JSON이 아니라 text 응답이라서 text() 사용
        setMessage(text);
      } catch (error) {
        console.error(error);
        setMessage("API 연결 실패");
      }
    };

    fetchApi();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="p-6 rounded-xl shadow-lg bg-white">
        <h1 className="text-xl font-bold mb-4">API 연결 확인</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}
