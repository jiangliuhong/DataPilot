"use client";

import { RouterProvider } from "@heroui/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <RouterProvider>{children}</RouterProvider>;
}
