import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listReviewQueue, reviewQueueCounts } from "@/lib/data/connectors";
import { ConnectorReviewQueueTable } from "@/components/admin/ConnectorReviewQueueTable";
import { CONNECTOR_STATUS_META } from "@/lib/constants/review";
import type { ConnectorStatus } from "@/lib/types/database.types";

export const metadata: Metadata = {
  title: "Connectors Review Queue",
  robots: { index: false, follow: false },
};

const TABS: ConnectorStatus[] = ["pending_review", "approved", "rejected"];

// Mirrors app/(app)/admin/review/skills/page.tsx.
export default async function ConnectorReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const userId = (await headers()).get("x-user-id");
  if (!userId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role !== "admin") notFound();

  const { status: rawStatus } = await searchParams;
  const status: ConnectorStatus = TABS.includes(rawStatus as ConnectorStatus)
    ? (rawStatus as ConnectorStatus)
    : "pending_review";

  const [rows, counts] = await Promise.all([listReviewQueue(supabase, status), reviewQueueCounts(supabase)]);

  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[30px] mb-6 sm:mb-8">
        Connectors review queue
      </h1>

      <div className="flex gap-1 mb-7 border-b border-[var(--border)]">
        {TABS.map((tab) => {
          const active = tab === status;
          const meta = CONNECTOR_STATUS_META[tab];
          return (
            <Link
              key={tab}
              href={`/admin/review/connectors?status=${tab}`}
              className={`px-3.5 py-2.5 -mb-px border-b-2 text-[13px] font-medium no-underline flex items-center gap-2 ${
                active
                  ? "text-[var(--text)] border-[var(--brass)]"
                  : "text-[var(--muted)] border-transparent hover:text-[var(--text)]"
              }`}
            >
              {meta.label}
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">
                {counts[tab]}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 px-5 border border-dashed border-[var(--border)] rounded-lg">
          <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--muted)]">
            {status === "pending_review"
              ? "Nothing waiting for review."
              : `No ${CONNECTOR_STATUS_META[status].label.toLowerCase()} connectors.`}
          </div>
        </div>
      ) : (
        <ConnectorReviewQueueTable rows={rows} status={status} />
      )}
    </div>
  );
}
