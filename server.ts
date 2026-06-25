/**
 * Custom server 入口。
 *
 * 用 next() 程序化启动 Next.js，并在同一个 HTTP server 实例上
 * 挂载 WebSocket 服务（/ws）。保留 Turbopack dev 与所有 App Router 能力。
 *
 * 运行：
 *   开发：tsx watch server.ts
 *   生产：NODE_ENV=production node --import tsx server.ts
 *
 * 注意：本文件不经过 Next 编译器，直接由 tsx 以 TS 运行。
 */
import { createServer } from "node:http";
import next from "next";
import { attachWebSocket } from "@/app/server/realtime";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  // 在同一个 HTTP server 上挂载 WebSocket（仅接管 /ws 的升级请求）
  attachWebSocket(server);

  server.listen(port, hostname, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? "development" : process.env.NODE_ENV
      } (WebSocket on /ws)`,
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
