import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许通过 127.0.0.1 等 localhost 之外的地址访问 dev server，
  // 否则 Next 16 的跨站开发保护会拦截 /_next/webpack-hmr 的 WebSocket 升级，
  // 导致浏览器一直报 "WebSocket connection to 'ws://127.0.0.1:3000/_next/webpack-hmr' failed"。
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
