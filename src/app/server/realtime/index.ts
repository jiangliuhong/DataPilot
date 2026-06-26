/**
 * 实时通道对外出口。
 *
 * - 业务代码：import { publish } from "@/app/server/realtime"
 * - custom server：import { attachWebSocket } from "@/app/server/realtime"
 */
export { publish, subscribe, unsubscribe } from "./event-bus";
export { attachWebSocket } from "./ws-server";
