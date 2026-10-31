"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Lightbulb,
  Hammer,
} from "lucide-react";

const menuItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Employees", path: "/employees", icon: Users },
  { name: "Inventory", path: "/inventory", icon: Package },
  { name: "Orders", path: "/orders", icon: ShoppingCart },
  { name: "Business Insights", path: "/insights", icon: Lightbulb },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-200 bg-white p-5">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-amber-100 p-2">
          <Hammer className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900">Carpenter BI</h1>
          <p className="text-xs text-slate-500">Workshop Dashboard</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-amber-100 text-amber-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-700">
          Workshop Management
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Manage employees, materials and orders.
        </p>
      </div>
    </aside>
  );
}