"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  searchConnectors,
  CONNECTORS_PAGE_SIZE,
  type ConnectorListFilters,
  type ConnectorWithTags,
} from "@/lib/data/connectors";
import {
  connectorSchema,
  parseTagsInput,
  slugify,
  type ConnectorFormValues,
} from "@/lib/validation/connector-schema";

export type ConnectorActionResult = { ok: true; slug: string } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Same shape/reasoning as app/actions/{prompts,skills}.ts's write rate
// limits — a separate bucket per resource type, keyed by user.
const CONNECTOR_WRITE_RATE_LIMIT = { max: 20, windowMs: 60_000 };

function checkConnectorWriteRateLimit(userId: string): { allowed: boolean } {
  return checkRateLimit(`connector-write:${userId}`, CONNECTOR_WRITE_RATE_LIMIT);
}

async function isAuthorOrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authorId: string
) {
  if (userId === authorId) return true;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

/** Generates a unique slug, appending -2, -3... on collision — mirrors
 * app/actions/{prompts,skills}.ts's uniqueSlug. */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string
) {
  const root = slugify(base) || "connector";
  let candidate = root;
  let attempt = 1;
  while (true) {
    let query = supabase.from("connectors").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    attempt += 1;
    candidate = `${root}-${attempt}`;
  }
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connectorId: string,
  tagsInput: string
) {
  const parsed = parseTagsInput(tagsInput);

  await supabase.from("connector_tags").delete().eq("connector_id", connectorId);
  if (parsed.length === 0) return;

  for (const tag of parsed) {
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("slug", tag.slug)
      .maybeSingle();

    const tagId =
      existing?.id ??
      (
        await supabase
          .from("tags")
          .insert({ name: tag.name, slug: tag.slug })
          .select("id")
          .single()
      ).data?.id;

    if (tagId) {
      await supabase.from("connector_tags").insert({ connector_id: connectorId, tag_id: tagId });
    }
  }
}

export async function createConnector(values: ConnectorFormValues): Promise<ConnectorActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkConnectorWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const parsed = connectorSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug = await uniqueSlug(supabase, fields.title);

  const { data, error } = await supabase
    .from("connectors")
    .insert({
      author_id: user.id,
      title: fields.title,
      slug,
      description: fields.description,
      category_id: fields.category_id,
      setup_steps: fields.setup_steps,
      config_snippet: fields.config_snippet,
      gotchas_notes: fields.gotchas_notes,
      docs_links: fields.docs_links,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("createConnector", error, "Could not create the connector.") };
  }

  await syncTags(supabase, data.id, fields.tagsInput ?? "");

  revalidatePath("/library/connectors");
  return { ok: true, slug: data.slug };
}

export async function updateConnector(
  connectorId: string,
  values: ConnectorFormValues
): Promise<ConnectorActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkConnectorWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("connectors")
    .select("id, author_id, slug, title")
    .eq("id", connectorId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Connector not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to edit this connector." };
  }

  const parsed = connectorSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug =
    fields.title === existing.title ? existing.slug : await uniqueSlug(supabase, fields.title, existing.id);

  const { error } = await supabase
    .from("connectors")
    .update({
      title: fields.title,
      slug,
      description: fields.description,
      category_id: fields.category_id,
      setup_steps: fields.setup_steps,
      config_snippet: fields.config_snippet,
      gotchas_notes: fields.gotchas_notes,
      docs_links: fields.docs_links,
    })
    .eq("id", connectorId);

  if (error) {
    return { ok: false, error: safeActionError("updateConnector", error, "Could not save your changes.") };
  }

  await syncTags(supabase, connectorId, fields.tagsInput ?? "");

  revalidatePath("/library/connectors");
  revalidatePath(`/library/connectors/${slug}`);
  return { ok: true, slug };
}

export async function deleteConnector(connectorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  if (!checkConnectorWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("connectors")
    .select("id, author_id")
    .eq("id", connectorId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Connector not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to delete this connector." };
  }

  const { error } = await supabase.from("connectors").delete().eq("id", connectorId);
  if (error) return { ok: false, error: safeActionError("deleteConnector", error, "Could not delete the connector.") };

  revalidatePath("/library/connectors");
  return { ok: true };
}

/** Fetches the next page of the Browse grid for infinite scroll. */
export async function loadMoreConnectors(
  filters: ConnectorListFilters,
  offset: number
): Promise<{ connectors: ConnectorWithTags[] }> {
  const supabase = await createClient();
  const connectors = await searchConnectors(supabase, filters, { offset, limit: CONNECTORS_PAGE_SIZE });
  return { connectors };
}

export async function duplicateConnector(connectorId: string): Promise<ConnectorActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkConnectorWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: source, error: fetchError } = await supabase
    .from("connectors")
    .select("title, description, category_id, setup_steps, config_snippet, gotchas_notes, docs_links")
    .eq("id", connectorId)
    .single();

  if (fetchError || !source) {
    return { ok: false, error: "Connector not found." };
  }

  const { data: sourceTags } = await supabase
    .from("connector_tags")
    .select("tags(name)")
    .eq("connector_id", connectorId);
  const tagsInput = (sourceTags ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const title = `${source.title} (Copy)`;
  const slug = await uniqueSlug(supabase, title);

  const { data: created, error } = await supabase
    .from("connectors")
    .insert({
      author_id: user.id,
      title,
      slug,
      description: source.description,
      category_id: source.category_id,
      setup_steps: source.setup_steps,
      config_snippet: source.config_snippet,
      gotchas_notes: source.gotchas_notes,
      docs_links: source.docs_links,
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return { ok: false, error: safeActionError("duplicateConnector", error, "Could not duplicate the connector.") };
  }

  await syncTags(supabase, created.id, tagsInput);

  revalidatePath("/library/connectors");
  return { ok: true, slug: created.slug };
}
