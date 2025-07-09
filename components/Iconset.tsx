import { FaInstagram, FaYoutube, FaSpotify } from "react-icons/fa";

export default function Iconset() {
  return (
    <div className="flex space-x-4 mt-2">
      {/* SNS 아이콘 */}
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
        <FaInstagram className="w-6 h-6 hover:opacity-70 transition" />
      </a>
      <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
        <FaYoutube className="w-6 h-6 hover:opacity-70 transition" />
      </a>
      <a href="https://spotify.com" target="_blank" rel="noopener noreferrer">
        <FaSpotify className="w-6 h-6 hover:opacity-70 transition" />
      </a>
    </div>
  );
}
