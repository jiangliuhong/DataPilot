/**
 * 进程内事件总线。
 *
 * 与传输层（WebSocket）解耦：业务代码只 import { publish }，
 * 由 ws-server 订阅事件总线并转发给 WebSocket 客户端。
 *
 * 这样初始化任务等业务逻辑可独立单测（不需要起 WS），
 * 未来也可同时接入 SSE 等其他传输。
 *
 * 实现说明：
 * 1. 所有事件统一 emit 到单个事件名 EVENT_NAME，topic 作为第一个参数。
 *    Node EventEmitter 是精确事件名匹配，不支持前缀/通配，
 *    因此 publish 与 subscribe/subscribeAll 必须用同一事件名。
 * 2. bus 实例挂在 globalThis 上。custom server 下 server.ts 与 Next 打包的
 *    API route 可能各自加载一份本模块（不同的模块注册表），导致 publish
 *    和 subscribeAll 落到不同 EventEmitter 实例上、事件丢失。
 *    用 global 单例保证全进程唯一实例。
 */
import { EventEmitter } from "node:events";

/** 事件总线内部使用的唯一 Event 名（所有事件都 emit 到这里，topic 作为参数） */
const EVENT_NAME = "message";

const GLOBAL_KEY = Symbol.for("DataPilot.realtime.eventBus");

interface RealtimeGlobal {
  [GLOBAL_KEY]?: EventEmitter;
}

/** 取/建全进程唯一的 EventEmitter 实例（跨模块加载副本共享） */
function getBus(): EventEmitter {
  const g = globalThis as unknown as RealtimeGlobal;
  if (!g[GLOBAL_KEY]) {
    const bus = new EventEmitter();
    bus.setMaxListeners(100);
    g[GLOBAL_KEY] = bus;
  }
  return g[GLOBAL_KEY]!;
}

export interface RealtimeEvent {
  topic: string;
  event: string;
  data: unknown;
}

/** 订阅指定主题的事件 */
export function subscribe(
  topic: string,
  listener: (event: string, data: unknown) => void,
): void {
  getBus().on(EVENT_NAME, (t: string, e: string, d: unknown) => {
    if (t === topic) listener(e, d);
  });
}

/** 取消订阅指定主题的事件 */
export function unsubscribe(
  topic: string,
  listener: (event: string, data: unknown) => void,
): void {
  getBus().off(EVENT_NAME, listener as (...args: unknown[]) => void);
}

/**
 * 向某主题发布事件。
 * 无订阅者时安全返回，不报错。
 */
export function publish(topic: string, event: string, data: unknown): void {
  getBus().emit(EVENT_NAME, topic, event, data);
}

/**
 * 订阅所有主题（通配）—— 供 WebSocket 服务转发使用。
 * listener 收到的参数为完整 RealtimeEvent。
 */
export function subscribeAll(
  listener: (evt: RealtimeEvent) => void,
): void {
  getBus().on(EVENT_NAME, (topic: string, event: string, data: unknown) =>
    listener({ topic, event, data }),
  );
}
