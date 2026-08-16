import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listReviewQueue, reviewQueueCounts } from "@/lib/data/prompts";
import { ReviewQueueTable } from "@/components/admin/ReviewQueueTable";
import { PROMPT_STATUS_META } from "@/lib/constants/review";
import type { PromptStatus } from "@/lib/types/database.types";

const TABS: PromptStatus[] = ["pending_review", "approved", "rejected"];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 404 rather than redirect for both the no-session and non-admin cases —
  // this route's existence isn't something a non-admin needs to know about.
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") notFound();

  const { status: rawStatus } = await searchParams;
  const status: PromptStatus = TABS.includes(rawStatus as PromptStatus)
    ? (rawStatus as PromptStatus)
    : "pending_review";

  const [rows, counts] = await Promise.all([
    listReviewQueue(supabase, status),
    reviewQueueCounts(supabase),
  ]);

  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[30px] mb-6 sm:mb-8">
        Review queue
      </h1>

      <div className="flex gap-1 mb-7 border-b border-[var(--border)]">
        {TABS.map((tab) => {
          const active = tab === status;
          const meta = PROMPT_STATUS_META[tab];
          return (
            <Link
              key={tab}
              href={`/admin/review?status=${tab}`}
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
              : `No ${PROMPT_STATUS_META[status].label.toLowerCase()} prompts.`}
          </div>
        </div>
      ) : (
        <ReviewQueueTable rows={rows} status={status} />
      )}
    </div>
  );
}
