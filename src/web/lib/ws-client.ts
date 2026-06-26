/**
 * 通用 WebSocket 客户端封装。
 *
 * - 单例连接 ws://<host>/ws
 * - 自动重连（指数退避，最多 30s）
 * - subscribe(topic, handler) / unsubscribe(topic, handler)
 * - 多个组件订阅同一 topic 互不影响
 *
 * 协议（与服务端 realtime/ws-server 对齐）：
 *   client → server: { type: "subscribe"|"unsubscribe", topic }
 *   server → client: { type: "event", topic, event, data }
 */
"use client";

export interface RealtimeEvent {
  type: "event";
  topic: string;
  event: string;
  data: unknown;
}

type EventHandler = (event: string, data: unknown) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  /** 本端订阅表：topic → handler 集合（组件级订阅） */
  private subscriptions = new Map<string, Set<EventHandler>>();
  /** 连接就绪后的回调 */
  private onReady: (() => void)[] = [];

  constructor() {
    if (typeof window === "undefined") {
      this.url = "";
      return;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${proto}//${window.location.host}/ws`;
  }

  private connect() {
    if (typeof window === "undefined" || !this.url) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      // 重连后重新订阅所有主题
      for (const topic of this.subscriptions.keys()) {
        this.send({ type: "subscribe", topic });
      }
      // 触发 ready 回调
      const cbs = this.onReady.splice(0);
      cbs.forEach((cb) => cb());
    };

    this.ws.onmessage = (evt) => {
      let msg: RealtimeEvent;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.type !== "event") return;
      const handlers = this.subscriptions.get(msg.topic);
      if (handlers) {
        handlers.forEach((h) => h(msg.event, msg.data));
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose 会随后触发，由它负责重连
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(msg: { type: string; topic: string }) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private ensureConnected(cb: () => void) {
    if (this.connected) {
      cb();
      return;
    }
    this.onReady.push(cb);
    this.connect();
  }

  /** 订阅某主题；返回取消订阅函数。 */
  subscribe(topic: string, handler: EventHandler): () => void {
    let handlers = this.subscriptions.get(topic);
    const isNewTopic = !handlers;
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(topic, handlers);
    }
    handlers.add(handler);

    if (isNewTopic) {
      this.ensureConnected(() => this.send({ type: "subscribe", topic }));
    }

    return () => this.unsubscribe(topic, handler);
  }

  unsubscribe(topic: string, handler: EventHandler) {
    const handlers = this.subscriptions.get(topic);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.subscriptions.delete(topic);
      this.send({ type: "unsubscribe", topic });
    }
  }
}

/** 单例 */
let instance: WsClient | null = null;

export function getWsClient(): WsClient {
  if (!instance) instance = new WsClient();
  return instance;
}
