// src/lib/supabaseGSSP.ts
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { GetServerSidePropsContext } from "next";

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  // "a=b; c=d" 형태
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;

    const rawName = part.slice(0, idx).trim();
    const rawValue = part.slice(idx + 1).trim();

    if (!rawName) continue;

    try {
      out[rawName] = decodeURIComponent(rawValue);
    } catch {
      out[rawName] = rawValue;
    }
  }

  return out;
}

function serializeSetCookie(name: string, value: string, options: CookieOptions): string {
  // 기본값
  const parts: string[] = [];

  const encValue = encodeURIComponent(value);
  parts.push(`${name}=${encValue}`);

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);

  // sameSite: boolean | "lax" | "strict" | "none" 형태로 오는 경우를 모두 처리
  if (options.sameSite !== undefined) {
    const s = options.sameSite;
    if (s === true) parts.push("SameSite=Strict");
    else if (s === false) {
      // nothing
    } else {
      const v = String(s).toLowerCase();
      if (v === "lax") parts.push("SameSite=Lax");
      else if (v === "strict") parts.push("SameSite=Strict");
      else if (v === "none") parts.push("SameSite=None");
    }
  }

  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");

  return parts.join("; ");
}

function appendSetCookieHeader(ctx: GetServerSidePropsContext, cookieStr: string) {
  const prev = ctx.res.getHeader("Set-Cookie");

  if (!prev) {
    ctx.res.setHeader("Set-Cookie", cookieStr);
    return;
  }

  if (typeof prev === "string") {
    ctx.res.setHeader("Set-Cookie", [prev, cookieStr]);
    return;
  }

  if (Array.isArray(prev)) {
    ctx.res.setHeader("Set-Cookie", [...prev, cookieStr]);
    return;
  }

  // 드물지만 other 타입이면 덮어쓰기
  ctx.res.setHeader("Set-Cookie", cookieStr);
}

/**
 * Pages Router(getServerSideProps)에서 쓰는 Supabase 서버 클라이언트
 *
 * 사용 예:
 * export const getServerSideProps = async (ctx) => {
 *   const supabase = supabaseServerForGSSP(ctx);
 *   const { data: { user } } = await supabase.auth.getUser();
 *   ...
 * }
 */
export function supabaseServerForGSSP(ctx: GetServerSidePropsContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        const jar = parseCookieHeader(ctx.req.headers.cookie);
        return jar[name];
      },

      set(name: string, value: string, options: CookieOptions) {
        const cookieStr = serializeSetCookie(name, value, options);
        appendSetCookieHeader(ctx, cookieStr);
      },

      remove(name: string, options: CookieOptions) {
        // 삭제는 보통 Max-Age=0 또는 Expires 과거로 설정
        const cookieStr = serializeSetCookie(name, "", {
          ...options,
          maxAge: 0,
        });
        appendSetCookieHeader(ctx, cookieStr);
      },
    },
  });
}
