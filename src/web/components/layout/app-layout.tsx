"use client";

import { useState } from "react";
import Sidebar from "@/web/components/layout/sidebar";
import ContentPanel from "@/web/components/layout/content-panel";
import type { MenuItem } from "@/web/types/menu";

interface AppLayoutProps {
  menuItems: MenuItem[];
}

export default function AppLayout({ menuItems }: AppLayoutProps) {
  const [activeKey, setActiveKey] = useState<string>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Left sidebar */}
      <aside
        className={`shrink-0 border-r border-default-200 bg-white transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <Sidebar
          items={menuItems}
          activeKey={activeKey}
          onSelect={setActiveKey}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* Right content area */}
      <main className="flex-1 overflow-y-auto bg-background">
        <ContentPanel activeKey={activeKey} />
      </main>
    </div>
  );
}
