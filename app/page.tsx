import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { KoverLogo } from "@/components/kover-logo";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-4">
        <div>
          <KoverLogo size="lg" />
          <h1 className="mt-2 text-4xl font-semibold tracking-normal">
            Policy, renewal, payment, and commission tracking.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-zinc-600">
            Private CRM workspace connected to Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasEnvVars ? (
            <>
              <Button asChild>
                <Link href="/protected">Open CRM</Link>
              </Button>
              <Suspense>
                <AuthButton />
              </Suspense>
            </>
          ) : (
            <p className="text-sm text-red-700">
              Supabase environment values are missing.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
