import "@/styles/globals.css";
import Navbar from "@/components/Navbar"
import type { AppProps } from "next/app";
import { useRouter } from "next/router";

import { ThemeProvider } from 'next-themes';
//import ThemeToggle from '@/components/ThemeToggle';
import AmbientMixer from "@/components/ambient/AmbientMixer";
import Iconset from "@/components/Iconset";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideChrome = router.pathname === "/login";

  return (
    <ThemeProvider attribute="class"> 
      {!hideChrome && <Navbar />}
      {!hideChrome && (
        <div className="fixed bottom-6 right-4 z-50">
          <Iconset />
        </div>
      )}
      <AmbientMixer />
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
