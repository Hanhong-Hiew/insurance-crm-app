"use client";

import {
  BadgeDollarSign,
  ChevronDown,
  FileText,
  Home,
  PanelsTopLeft,
  Settings,
  TableProperties,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const menuItems = [
  { href: "/protected/records", label: "Records", icon: TableProperties },
  { href: "/protected/clients", label: "Clients", icon: Users },
  { href: "/protected/commission-payments", label: "Commission", icon: BadgeDollarSign },
  { href: "/protected/settings", label: "Settings", icon: Settings },
  { href: "/protected/design-preview", label: "Design Preview", icon: PanelsTopLeft },
  { href: "/protected/new-policy", label: "New Policy", icon: FileText },
];

export function AppMenu({
  activeHref,
  path = ["Dashboard"],
}: {
  activeHref?: string;
  path?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col items-start gap-2 md:items-end">
      <nav
        aria-label="Page path"
        className="flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500"
      >
        <Home className="h-3.5 w-3.5 text-sky-600" />
        {path.map((label, index) => (
          <span className="flex items-center gap-1" key={`${label}-${index}`}>
            {index > 0 ? <span className="text-slate-300">/</span> : null}
            <span className={index === path.length - 1 ? "text-slate-800" : ""}>
              {label}
            </span>
          </span>
        ))}
      </nav>

      <div className="relative">
        <button
          aria-expanded={open}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          Menu
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <Link
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition hover:bg-sky-50 ${
                activeHref === "/protected"
                  ? "bg-sky-50 text-sky-800"
                  : "text-slate-700"
              }`}
              href="/protected"
              onClick={() => setOpen(false)}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;
              return (
                <Link
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition hover:bg-sky-50 ${
                    active ? "bg-sky-50 text-sky-800" : "text-slate-700"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
