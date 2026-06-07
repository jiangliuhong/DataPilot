"use client";

import { RouterProvider, Toast } from "@heroui/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RouterProvider navigate={(path) => window.history.pushState(null, "", path)}>
      <Toast.Provider>{children}</Toast.Provider>
    </RouterProvider>
  );
}
