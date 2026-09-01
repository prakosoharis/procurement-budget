import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces the self-contained server.js the Dockerfile copies
  // into the runner stage. Vercel's own build pipeline expects the default
  // output shape — forcing standalone there breaks routing (all-404s) — so
  // only turn it on when we're building outside Vercel (Vercel always sets
  // the VERCEL env var during builds).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
