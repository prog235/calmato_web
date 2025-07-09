import "@/styles/globals.css";
import Navbar from "@/components/Navbar"
import type { AppProps } from "next/app";

import { ThemeProvider } from 'next-themes';
import ThemeToggle from '@/components/ThemeToggle';
import Iconset from "@/components/Iconset";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class"> 
      <Navbar /> 
      <div className="fixed bottom-6 right-12 z-50">
        <Iconset />
      </div>
      <div className="fixed bottom-6 left-6 z-50">
        <ThemeToggle />
      </div>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
