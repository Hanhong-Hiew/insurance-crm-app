"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import type { SettingsActionState } from "@/app/protected/settings/actions";
import { ActionMessage } from "@/components/action-message";

type SettingsAction = (
  previousState: SettingsActionState,
  formData: FormData,
) => Promise<SettingsActionState>;

export function SettingsRowForm({
  action,
  children,
  className,
  submitLabel = "Save",
}: {
  action: SettingsAction;
  children: React.ReactNode;
  className: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    action,
    {},
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} className={className}>
      {children}
      <SettingsSaveButton label={submitLabel} />
      <div className="md:col-span-full">
        <ActionMessage message={state.error} tone="error" />
        <ActionMessage message={state.success} tone="success" />
      </div>
    </form>
  );
}

function SettingsSaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-10 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}
