"use server";

import { revalidatePath } from "next/cache";
import { getPostgresClient } from "@/lib/db/postgres";
import { requireConsoleOperator } from "@/lib/moderation/console-access";
import { assertCan } from "@/lib/moderation/capabilities";
import { marketFinderReportDecisionInputSchema } from "@/lib/moderation/schema";
import { decideMarketFinderReport } from "@/lib/moderation/transitions";
import { listPendingContributions } from "@/lib/moderation/queues";
import { contributionWorkItem } from "./market-report-presentation";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function revalidateContributionSurfaces() {
  revalidatePath("/ops/contributions");
  revalidatePath("/ops");
  revalidatePath("/ops", "layout");
  revalidatePath("/ops/activity");
}

export async function decideMarketFinderReportAction(
  _previous: unknown,
  formData: FormData,
) {
  const requested = formData.get("contributionId");
  const requestedId =
    typeof requested === "string" && requested ? requested : undefined;
  try {
    const operator = await requireConsoleOperator();
    assertCan(operator, "market-reports.decide");
    const input = marketFinderReportDecisionInputSchema.parse({
      contributionId: formData.get("contributionId"),
      decision: formData.get("decision"),
      rationale: formData.get("rationale"),
    });
    await decideMarketFinderReport(
      getPostgresClient(),
      operator.authSubject,
      input.contributionId,
      input.decision,
      input.rationale,
    );
    revalidateContributionSurfaces();
    return {
      ok: true as const,
      targetId: input.contributionId,
      decision: input.decision,
    };
  } catch (error) {
    console.error("Could not save Market Finder report decision.", error);
    return {
      ok: false as const,
      targetId: requestedId,
      error: "Couldn’t save this Market Finder decision. Try again.",
    };
  }
}

export async function fetchMoreContributionsAction(
  afterSubmittedAt: string,
  afterId: string,
  limit = 40,
) {
  await requireConsoleOperator();

  const parsedDate = new Date(afterSubmittedAt);
  if (!Number.isFinite(parsedDate.valueOf()) || !uuidPattern.test(afterId)) {
    throw new Error("Invalid contribution cursor.");
  }

  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 40;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const fetchedRows = await listPendingContributions(
    getPostgresClient(),
    safeLimit + 1,
    {
      submittedAt: afterSubmittedAt,
      id: afterId,
    },
  );
  const rows = fetchedRows.slice(0, safeLimit);
  const lastRow = rows.at(-1);

  return {
    items: rows.map(contributionWorkItem),
    hasMore: fetchedRows.length > safeLimit,
    nextCursor: lastRow
      ? { submittedAt: lastRow.submittedAt, id: lastRow.id }
      : null,
  };
}
