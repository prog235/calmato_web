import { useState } from "react";
import emailjs from "emailjs-com";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const templateParams = {
      name,
      email,
      message,
    };

    emailjs
      .send(
        "service_fhvwi58",
        "template_s8onj3a",
        templateParams,
        "etjm4g6sjy9c4Nw8r"
      )
      .then(() => {
        alert("메시지가 성공적으로 전송되었습니다!");
        setName("");
        setEmail("");
        setMessage("");
      })
      .catch((error) => {
        console.error(error);
        alert("전송 중 오류가 발생했습니다. 다시 시도해주세요.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Contact</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <textarea
          placeholder="문의 내용"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`p-2 rounded text-white ${
            loading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? "전송 중..." : "전송하기"}
        </button>
      </form>
    </main>
  );
}
