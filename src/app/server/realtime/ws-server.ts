/**
 * WebSocket 服务端：在 custom server 上挂载。
 *
 * 仅接管升级到 /ws 的请求，其余升级请求交回 Next.js。
 * 维护 topic → Set<WebSocket> 订阅表，处理客户端 JSON 消息
 * （subscribe / unsubscribe），并把事件总线的事件转发给订阅者。
 *
 * 协议（JSON）：
 *   client → server: { type: "subscribe"|"unsubscribe", topic }
 *   server → client: { type: "event", topic, event, data }
 */
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { subscribeAll } from "./event-bus";

/** WebSocket 端点路径 */
const WS_PATH = "/ws";

/** 每个 WebSocket 连接附带其订阅的主题集合 */
const socketTopics = new WeakMap<WebSocket, Set<string>>();

/** topic → 订阅的 WebSocket 集合 */
const topicSockets = new Map<string, Set<WebSocket>>();

function addSubscription(ws: WebSocket, topic: string): void {
  let topics = socketTopics.get(ws);
  if (!topics) {
    topics = new Set();
    socketTopics.set(ws, topics);
  }
  topics.add(topic);

  let sockets = topicSockets.get(topic);
  if (!sockets) {
    sockets = new Set();
    topicSockets.set(topic, sockets);
  }
  sockets.add(ws);
}

function removeSubscription(ws: WebSocket, topic: string): void {
  socketTopics.get(ws)?.delete(topic);
  const sockets = topicSockets.get(topic);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) topicSockets.delete(topic);
  }
}

function removeAllSubscriptions(ws: WebSocket): void {
  const topics = socketTopics.get(ws);
  if (!topics) return;
  for (const topic of topics) {
    const sockets = topicSockets.get(topic);
    sockets?.delete(ws);
    if (sockets && sockets.size === 0) topicSockets.delete(topic);
  }
  topics.clear();
  socketTopics.delete(ws);
}

function handleMessage(ws: WebSocket, raw: string): void {
  let msg: { type?: string; topic?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    // 无法解析的消息直接忽略，不断开连接
    return;
  }
  if (!msg.type || !msg.topic) return;
  if (msg.type === "subscribe") {
    addSubscription(ws, msg.topic);
  } else if (msg.type === "unsubscribe") {
    removeSubscription(ws, msg.topic);
  }
  // 未知 type 忽略
}

/**
 * 在给定 HTTP server 上挂载 WebSocket 服务。
 * 应在 server.listen 之前调用。
 */
export function attachWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== WS_PATH) {
      // 非 /ws 路径：不接管，交回给 Next（这里不处理，让 Next 的 dev HMR 等正常工作）
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    ws.on("message", (data) => handleMessage(ws, data.toString()));
    ws.on("close", () => removeAllSubscriptions(ws));
    ws.on("error", () => removeAllSubscriptions(ws));
  });

  // 订阅事件总线，把事件转发给订阅了对应主题的 WebSocket 客户端
  subscribeAll((evt) => {
    const sockets = topicSockets.get(evt.topic);
    if (!sockets || sockets.size === 0) return;
    const payload = JSON.stringify({
      type: "event",
      topic: evt.topic,
      event: evt.event,
      data: evt.data,
    });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  });

  return wss;
}
