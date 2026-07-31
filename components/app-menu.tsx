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
import { useEffect, useRef, useState } from "react";

const menuItems = [
  { href: "/protected/records", label: "Records", icon: TableProperties },
  { href: "/protected/clients", label: "Clients", icon: Users },
  { href: "/protected/commission-payments", label: "Commission", icon: BadgeDollarSign },
  { href: "/protected/settings", label: "Settings", icon: Settings },
  { href: "/protected/design-preview", label: "Design Preview", icon: PanelsTopLeft },
];

export function AppMenu({
  activeHref,
  path = ["Dashboard"],
}: {
  activeHref?: string;
  path?: string[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigationItems = [{ href: "/protected", label: "Dashboard", icon: Home }, ...menuItems];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeFromOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

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

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="hidden items-center gap-1 lg:flex">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;

            return (
              <Link
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold shadow-sm transition ${
                  active
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <Link
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm transition ${
            activeHref === "/protected/new-policy"
              ? "bg-slate-900 text-white"
              : "bg-sky-600 text-white hover:bg-sky-700"
          }`}
          href="/protected/new-policy"
        >
          <FileText className="h-4 w-4" />
          Add Policy
        </Link>

        <div className="lg:hidden" ref={menuRef}>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            Menu
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          </button>

          {open ? (
            <div
              className="mt-2 max-h-[70vh] w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
              role="menu"
            >
              {navigationItems.map((item) => {
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
                    role="menuitem"
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
    </div>
  );
}
