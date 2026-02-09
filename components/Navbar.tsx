import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function Navbar() {
  const router = useRouter();

  const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/archive", label: "Archive" },
    { href: "/community", label: "Community" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header
      className="
        w-full
        px-8 sm:px-12 md:px-16
        py-8
        flex
        items-center
        justify-between
      "
    >
      {/* 좌측: Calmato 로고 */}
      <Link
        href="/"
        className="relative w-[160px] h-[80px] hover:opacity-80 transition"
      >
        {/* Light */}
        <Image
          src="/calmato_b_logo@4x.png"
          alt="Calmato Logo Light"
          fill
          className="object-contain logo-light"
          priority
        />

        {/* Dark */}
        <Image
          src="/calmato_w_logo@4x.png"
          alt="Calmato Logo Dark"
          fill
          className="object-contain logo-dark"
          priority
        />
      </Link>

      {/* 우측: 네비게이션 */}
      <nav className="flex items-center gap-10 text-[15px]">
        {links.map((link) => {
          const isActive = router.pathname === link.href;

          return (
            <motion.div
              key={link.href}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Link
                href={link.href}
                className={`
                  transition
                  ${
                    isActive
                      ? "font-semibold text-white"
                      : "text-white/80 hover:text-white"
                  }
                `}
              >
                {link.label}
              </Link>
            </motion.div>
          );
        })}

        {/* 우측 끝: 프로필 아이콘 (선택) */}
        <Link href="/profile">
          <div className="ml-2 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-sm text-white/80">👤</span>
          </div>
        </Link>  
      </nav>
    </header>
  );
}
