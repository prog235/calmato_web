import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function Navbar() {
  const router = useRouter();

  const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/project", label: "Project" },
    { href: "/community", label: "Community" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="flex flex-col items-center mt-8 mb-4">
      {/* Calmato 로고 (클릭 시 홈 이동) */}
      <Link href="/" className="hover:opacity-80 transition block w-[180px] h-[80px] relative">
        {/* 라이트 모드용 로고 */}
        <Image
          src="/calmato_b_logo@4x.png"
          alt="Calmato Logo Light"
          fill
          className="object-contain logo-light"
          priority
        />

        {/* 다크 모드용 로고 */}
        <Image
          src="/calmato_w_logo@4x.png"
          alt="Calmato Logo Dark"
          fill
          className="object-contain logo-dark"
          priority
        />
      </Link>


      {/* 메뉴 */}
      <nav className="grid grid-cols-5 w-full max-w-2xl text-[16px] text-center mt-4 mb-4">
        {links.map((link) => (
          <motion.div
            key={link.href}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Link
              href={link.href}
              className={
                `transition ${router.pathname === link.href ? "font-semibold" : "hover:text-gray-400"
              }`}
            >
              {link.label}
            </Link>
          </motion.div>
        ))}
      </nav>
    </header>
  );
}

