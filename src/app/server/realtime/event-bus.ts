/**
 * 进程内事件总线。
 *
 * 与传输层（WebSocket）解耦：业务代码只 import { publish }，
 * 由 ws-server 订阅事件总线并转发给 WebSocket 客户端。
 *
 * 这样初始化任务等业务逻辑可独立单测（不需要起 WS），
 * 未来也可同时接入 SSE 等其他传输。
 */
import { EventEmitter } from "node:events";

/** 事件总线内部使用的 Event 名 */
const EVENT_NAME = "message";

/** 事件总线单例（模块级实例） */
const bus = new EventEmitter();
// 同一主题可能有多个订阅者，提高监听器上限避免 MaxListeners 警告
bus.setMaxListeners(100);

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
  bus.on(`${EVENT_NAME}:${topic}`, (e: string, d: unknown) =>
    listener(e, d),
  );
}

/** 取消订阅指定主题的事件 */
export function unsubscribe(
  topic: string,
  listener: (event: string, data: unknown) => void,
): void {
  bus.off(`${EVENT_NAME}:${topic}`, listener);
}

/**
 * 向某主题发布事件。
 * 无订阅者时安全返回，不报错。
 */
export function publish(topic: string, event: string, data: unknown): void {
  bus.emit(`${EVENT_NAME}:${topic}`, event, data);
}

/**
 * 订阅所有主题（通配）—— 供 WebSocket 服务转发使用。
 * listener 收到的参数为完整 RealtimeEvent。
 */
export function subscribeAll(
  listener: (evt: RealtimeEvent) => void,
): void {
  bus.on(EVENT_NAME, (topic: string, event: string, data: unknown) =>
    listener({ topic, event, data }),
  );
}
