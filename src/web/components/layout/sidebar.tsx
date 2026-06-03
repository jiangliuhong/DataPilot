"use client";

import { ScrollShadow } from "@heroui/react";
import {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import type { MenuItem } from "@/web/types/menu";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  Users,
};

interface SidebarProps {
  items: MenuItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* User profile header */}
      <div className={`px-4 py-5 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-bold">
            A
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
              A
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Admin</p>
              <p className="text-xs text-default-400 truncate">管理员</p>
            </div>
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-default-200" />

      {/* Menu items */}
      <ScrollShadow className="flex-1 overflow-y-auto px-3 py-3">
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon ? iconMap[item.icon] : null;
            const isActive = activeKey === item.key;

            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-default-100 text-foreground font-medium"
                    : "text-default-500 hover:bg-default-50 hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`}
              >
                {Icon && <Icon size={20} strokeWidth={1.8} className="shrink-0" />}
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-md bg-success-100 text-success-600 px-1.5 py-0.5 text-[10px] font-medium leading-none">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </ScrollShadow>

      {/* Collapse toggle */}
      <div className="px-3 pb-3">
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-default-400 hover:bg-default-50 hover:text-foreground transition-colors w-full ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} strokeWidth={1.8} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose size={20} strokeWidth={1.8} className="shrink-0" />
              <span>收起菜单</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
