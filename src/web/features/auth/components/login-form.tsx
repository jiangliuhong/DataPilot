"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@heroui/react";
import { useAuth } from "../hooks/use-auth";

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace("/");
    } catch (err) {
      // 失败：保留用户名、清空密码，便于重试
      setPassword("");
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="login-username">用户名</Label>
        <Input
          id="login-username"
          fullWidth
          placeholder="请输入用户名"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="login-password">密码</Label>
        <Input
          id="login-password"
          type="password"
          fullWidth
          placeholder="请输入密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isDisabled={
          submitting || username.trim() === "" || password === ""
        }
      >
        {submitting ? "登录中…" : "登录"}
      </Button>
    </form>
  );
}
