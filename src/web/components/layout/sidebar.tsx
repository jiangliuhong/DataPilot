"use client";

import { Button, ScrollShadow } from "@heroui/react";
import {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  Users,
  GitBranch,
  Database,
  Server,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { MenuItem } from "@/web/types/menu";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  Users,
  GitBranch,
  Database,
  Server,
  Bot,
};

interface SidebarProps {
  items: MenuItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function MenuButton({
  item,
  isActive,
  collapsed,
  onSelect,
  indent,
}: {
  item: MenuItem;
  isActive: boolean;
  collapsed: boolean;
  onSelect: (key: string) => void;
  indent?: boolean;
}) {
  const Icon = item.icon ? iconMap[item.icon] : null;

  return (
    <Button
      fullWidth
      variant="ghost"
      onPress={() => onSelect(item.key)}
      className={`flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm h-auto font-normal ${
        isActive
          ? "bg-default-100 text-foreground font-medium"
          : "text-default-500 hover:bg-default-50 hover:text-foreground"
      } ${collapsed ? "!px-0" : ""} ${indent ? "pl-9" : ""}`}
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
    </Button>
  );
}

export default function Sidebar({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["system-settings"]),
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

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
              <p className="text-sm font-semibold text-foreground truncate">
                Admin
              </p>
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
            if (item.children && item.children.length > 0) {
              const isExpanded = expandedGroups.has(item.key ?? "");
              const hasActiveChild = item.children.some(
                (c) => activeKey === c.key,
              );

              return (
                <div key={item.key}>
                  <Button
                    fullWidth
                    variant="ghost"
                    onPress={() => toggleGroup(item.key ?? "")}
                    className={`flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm h-auto font-normal ${
                      hasActiveChild
                        ? "text-foreground font-medium"
                        : "text-default-500 hover:bg-default-50 hover:text-foreground"
                    } ${collapsed ? "!px-0" : ""}`}
                  >
                    {item.icon &&
                      (() => {
                        const Icon = iconMap[item.icon];
                        return Icon ? (
                          <Icon
                            size={20}
                            strokeWidth={1.8}
                            className="shrink-0"
                          />
                        ) : null;
                      })()}
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        <ChevronDown
                          size={16}
                          className={`ml-auto shrink-0 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}
                  </Button>
                  {isExpanded &&
                    !collapsed &&
                    item.children.map((child) => (
                      <MenuButton
                        key={child.key}
                        item={child}
                        isActive={activeKey === child.key}
                        collapsed={collapsed}
                        onSelect={onSelect}
                        indent
                      />
                    ))}
                </div>
              );
            }

            return (
              <MenuButton
                key={item.key}
                item={item}
                isActive={activeKey === item.key}
                collapsed={collapsed}
                onSelect={onSelect}
              />
            );
          })}
        </nav>
      </ScrollShadow>

      {/* Collapse toggle */}
      <div className="px-3 pb-3">
        <Button
          fullWidth
          variant="ghost"
          onPress={onToggleCollapse}
          className={`flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm text-default-400 hover:bg-default-50 hover:text-foreground h-auto font-normal ${
            collapsed ? "!px-0" : ""
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} strokeWidth={1.8} className="shrink-0" />
          ) : (
            <>
              <PanelLeftClose
                size={20}
                strokeWidth={1.8}
                className="shrink-0"
              />
              <span>收起菜单</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
