import { Card, CardContent } from "@heroui/react";
import LoginForm from "@/web/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">DataPilot</h1>
          <p className="mt-1 text-sm text-default-500">登录以继续</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
