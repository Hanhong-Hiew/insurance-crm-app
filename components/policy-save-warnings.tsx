"use client";
export function PolicySaveWarnings({ warning, token, required }: { warning?: string; token?: string; required?: boolean }) {
  if (!required) return null;
  return <div key={token} role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p className="whitespace-pre-line">{warning}</p>
    <input type="hidden" name="_warning_token" value={token ?? ""} />
    <label className="flex items-start gap-2 font-medium"><input className="mt-1" type="checkbox" name="_acknowledge_warnings" value="yes" required /> I checked these warnings and want to save.</label>
  </div>;
}
