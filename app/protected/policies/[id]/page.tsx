import { ArrowLeft, FileText, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { PolicyActionsCard } from "@/components/policy-actions-card";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailRow = Record<string, unknown> | null;

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function percent(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return `${(amount * 100).toFixed(0)}%`;
}

function clean(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("_", " ");
}

function payeeName(value: unknown) {
  if (Array.isArray(value)) {
    return clean((value[0] as { name?: unknown } | undefined)?.name);
  }
  return clean((value as { name?: unknown } | null | undefined)?.name);
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(`${String(value)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function PolicyRecordPage({ params }: PageProps) {
  return (
    <Suspense fallback={<PageShell>Loading record...</PageShell>}>
      <PolicyRecordContent params={params} />
    </Suspense>
  );
}

async function PolicyRecordContent({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData?.claims) {
    redirect("/auth/login");
  }

  const [
    recordResult,
    motorResult,
    fireResult,
    marineResult,
    travelResult,
    genericResult,
    commissionsResult,
    documentsResult,
    tasksResult,
    termNotesResult,
  ] = await Promise.all([
    supabase.from("main_policy_view").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase
      .from("motor_policy_details")
      .select("*, vehicles(*)")
      .eq("policy_term_id", id)
      .maybeSingle(),
    supabase.from("fire_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("marine_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("travel_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase.from("generic_policy_details").select("*").eq("policy_term_id", id).maybeSingle(),
    supabase
      .from("commissions")
      .select("id, calculation_percent, amount, unpaid_amount, status, paid_date, commission_payees(name)")
      .eq("policy_term_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, document_type, status, file_name, public_url, uploaded_at")
      .eq("policy_term_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, task_type, title, due_date, status")
      .eq("policy_term_id", id)
      .order("due_date", { ascending: true }),
    supabase.from("policy_terms").select("notes").eq("id", id).maybeSingle(),
  ]);

  if (recordResult.error) throw recordResult.error;
  if (!recordResult.data) notFound();

  const record = recordResult.data as Record<string, unknown>;
  const typeDetail =
    (motorResult.data as DetailRow) ??
    (fireResult.data as DetailRow) ??
    (marineResult.data as DetailRow) ??
    (travelResult.data as DetailRow) ??
    (genericResult.data as DetailRow);
  const detailRows = buildDetailRows(typeDetail);

  return (
    <PageShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-sky-700">
                  {clean(record.insurance_type)}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  <Link
                    className="hover:text-sky-700"
                    href={`/protected/clients/${record.client_id}`}
                  >
                    {clean(record.client_name)}
                  </Link>
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {clean(record.vehicle_no || record.primary_risk_label || record.policy_number)}
                </p>
              </div>
              <Link
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700 shadow-sm"
                href={`/protected/policies/${id}/edit`}
              >
                <PenLine className="h-4 w-4" />
                Edit
              </Link>
            </div>
          </section>

          <InfoCard
            rows={[
              ["Policy No", clean(record.policy_number)],
              ["Insurer", clean(record.insurer_name)],
              ["Effective", formatDate(record.effective_date)],
              ["Expiry", formatDate(record.expiry_date)],
              ["Stage", clean(record.term_stage)],
              ["Policy Status", clean(record.policy_status || record.quotation_status)],
              ["Renewal", clean(record.renewal_status)],
              ["Premium Status", clean(record.premium_status)],
              ["Sum Assured", money(record.primary_sum_assured)],
              ["Gross Premium", money(record.gross_premium)],
              ["Net Premium", money(record.net_premium)],
              ["Notes", clean(termNotesResult.data?.notes)],
            ]}
            title="Policy Term"
          />

          <InfoCard rows={detailRows} title="Risk Details" />

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
              <h2 className="font-semibold text-slate-800">Commissions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-white text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Payee</th>
                    <th className="px-3 py-3 font-medium">Rate</th>
                    <th className="px-3 py-3 font-medium">Amount</th>
                    <th className="px-3 py-3 font-medium">Unpaid</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(commissionsResult.data ?? []).length ? (
                    (commissionsResult.data ?? []).map((commission) => (
                      <tr className="border-b border-slate-100" key={commission.id}>
                        <td className="px-3 py-3 font-medium">
                          {payeeName(commission.commission_payees)}
                        </td>
                        <td className="px-3 py-3">{percent(commission.calculation_percent)}</td>
                        <td className="px-3 py-3">{money(commission.amount)}</td>
                        <td className="px-3 py-3">{money(commission.unpaid_amount)}</td>
                        <td className="px-3 py-3">{clean(commission.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                        No commission rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <PolicyActionsCard policyTermId={id} />
          <ListCard
            empty="No documents yet."
            items={(documentsResult.data ?? []).map((document) => [
              clean(document.file_name || document.document_type),
              clean(document.status),
            ])}
            title="Documents"
          />
          <ListCard
            empty="No tasks yet."
            items={(tasksResult.data ?? []).map((task) => [
              clean(task.title),
              `${formatDate(task.due_date)} / ${clean(task.status)}`,
            ])}
            title="Tasks"
          />
        </aside>
      </div>
    </PageShell>
  );
}

function buildDetailRows(detail: DetailRow) {
  if (!detail) return [["Details", "No type-specific details saved."]];

  const vehicle = detail.vehicles as Record<string, unknown> | null | undefined;
  if (vehicle) {
    return [
      ["Vehicle No", clean(detail.vehicle_no_snapshot || vehicle.vehicle_no)],
      ["Motor Type", clean(detail.motor_type)],
      ["Type of Cover", clean(detail.type_of_cover)],
      ["NCD", percent(detail.ncd)],
      ["Make / Model", clean(vehicle.make_model)],
      ["Year", clean(vehicle.year_of_manufacture)],
      ["Engine CC", clean(vehicle.engine_cc)],
      ["Engine No", clean(vehicle.engine_no)],
      ["Chassis No", clean(vehicle.chassis_no)],
      ["BDM", clean(detail.bdm)],
      ["BTM", clean(detail.btm)],
      ["Extra Coverage", clean(detail.extra_coverage)],
      ["Description", clean(detail.motor_description)],
    ];
  }

  const rows = Object.entries(detail)
    .filter(([key]) => !["id", "policy_term_id", "created_at", "updated_at"].includes(key))
    .filter(([key]) => key !== "details_json")
    .map(([key, value]) => [
      key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      key.includes("date") ? formatDate(value) : key.includes("sum") ? money(value) : clean(value),
    ]);

  const detailJson = detail.details_json as Record<string, unknown> | null | undefined;
  if (detailJson && typeof detailJson === "object") {
    rows.push(
      ...Object.entries(detailJson)
        .filter(([, value]) => value !== null && value !== "")
        .map(([key, value]) => [
          key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          clean(value),
        ]),
    );
  }

  return rows;
}

function InfoCard({ rows, title }: { rows: string[][]; title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-sky-100 bg-sky-50/50 px-4 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <dl className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListCard({
  empty,
  items,
  title,
}: {
  empty: string;
  items: string[][];
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-sky-600" />
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map(([label, meta], index) => (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" key={`${label}-${index}`}>
              <p className="text-sm font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{meta}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-950">
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700"
            href="/protected"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5">{children}</div>
    </main>
  );
}
