import { z } from "zod";

/** 登录请求体校验 */
export const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(64),
  password: z.string().min(1, "密码不能为空").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
