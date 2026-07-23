"use client";

import { useEffect, useState } from "react";

type ActionMessageProps = {
  message?: string;
  messageKey?: number | string;
  tone: "error" | "success" | "warning";
};

const toneClass = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function ActionMessage({ message, messageKey, tone }: ActionMessageProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [message, messageKey]);

  if (!message || !visible) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${toneClass[tone]}`}>
      {message}
    </div>
  );
}
