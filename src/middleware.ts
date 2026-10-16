import { NextResponse } from "next/server";

// Baseline security headers for every response. The kiosk UI needs camera
// access on its own origin (getUserMedia), so Permissions-Policy allows
// camera=(self) and denies everything else sensitive.
export function middleware() {
  const res = NextResponse.next();
  const headers = res.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY"); // no clickjacking; kiosk runs fullscreen, not framed
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return res;
}

export const config = {
  matcher: "/:path*",
};
