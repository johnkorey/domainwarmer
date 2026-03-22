"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Flame,
  LayoutDashboard,
  Mail,
  Inbox,
  MousePointerClick,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/dashboard/accounts", icon: Mail },
  { label: "Seed Addresses", href: "/dashboard/seeds", icon: Inbox },
  { label: "Engagement", href: "/dashboard/engagement", icon: MousePointerClick },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Flame className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">Email Warmer</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
