import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function Navbar() {
  const router = useRouter();

  const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/project", label: "Project" },
    { href: "/request", label: "Request" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="flex flex-col items-center mt-10 mb-4">
      {/* Calmato 로고 (클릭 시 홈 이동) */}
      <Link href="/" className="text-5xl font-semibold hover:opacity-80 transition">
        Calmato
      </Link>

      {/* 메뉴 */}
      <nav className="grid grid-cols-5 w-full max-w-2xl text-[16px] text-center mt-6 mb-4">
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

