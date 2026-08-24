// Source of truth for DevAtlas's starter connectors — mirrors
// scripts/seed-skills-data.ts's convention (both scripts/seed-connectors.ts
// and any future `supabase db reset` seed script should read from here so
// they never drift). `category` here is the shared `categories` table's
// `key` for resource_type = 'connector' (seeded by
// supabase/migrations/20260824150000_connectors.sql), not a Postgres enum
// — scripts/seed-connectors.ts resolves it to a category_id at load time.
//
// Tool-agnostic by design (Phase 2's Context decision, plan-phase-2-...md):
// every connector below documents wiring an AI agent to a real external
// tool/data source (MCP servers, REST APIs, auth flows) — not framed
// around one vendor's agent product.

export interface SeedConnector {
  title: string;
  slug: string;
  description: string;
  category: "mcp_server_setup" | "api_integration" | "auth_and_tool_use" | "data_source_connector" | "browser_automation" | "other";
  tags: string[];
  setup_steps: string;
  config_snippet: string;
  gotchas_notes: string;
  docs_links: string;
}

export const SEED_CONNECTORS: SeedConnector[] = [
  // ─── mcp_server_setup (3) ──────────────────────────────────────────
  {
    title: "Wire Up the GitHub MCP Server",
    slug: "wire-up-the-github-mcp-server",
    description: "Give an MCP-capable agent read/write access to GitHub issues, PRs, and repo contents.",
    category: "mcp_server_setup",
    tags: ["mcp", "github", "git"],
    setup_steps:
      "1. Generate a GitHub fine-grained personal access token scoped to the repos you want the agent touching (Contents, Issues, Pull requests — read/write as needed; avoid org-wide scope). 2. Add the github MCP server to your agent's MCP config, passing the token via an env var, not inline in the config file. 3. Restart the agent/client so it picks up the new server. 4. Verify by asking the agent to list open issues on a known repo.",
    config_snippet:
      '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"],\n      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }\n    }\n  }\n}',
    gotchas_notes:
      "A classic (not fine-grained) PAT works but grants far more than the agent needs — prefer fine-grained tokens scoped per-repo. Rotate the token if it ever appears in agent output or logs. Rate limits are the authenticated-user's GitHub API limit (5,000/hr), shared across every tool call the agent makes.",
    docs_links: "[LINK: modelcontextprotocol.io server list] [LINK: GitHub fine-grained PAT docs]",
  },
  {
    title: "Wire Up the Filesystem MCP Server",
    slug: "wire-up-the-filesystem-mcp-server",
    description: "Sandbox an agent's file read/write access to specific directories via the filesystem MCP server.",
    category: "mcp_server_setup",
    tags: ["mcp", "filesystem"],
    setup_steps:
      "1. Decide the exact directories the agent should be allowed to touch — never point it at your home directory or a repo root with secrets in it. 2. Add the filesystem MCP server to the config, passing each allowed directory as a positional arg. 3. Restart the client. 4. Verify the agent can read inside an allowed directory and is refused outside it.",
    config_snippet:
      '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project", "/path/to/scratch"]\n    }\n  }\n}',
    gotchas_notes:
      "The allowed-directories list is enforced by the server, not the model — don't rely on prompting alone to keep an agent out of a directory you didn't exclude. Symlinks inside an allowed directory can point outside it; some server versions resolve and block this, older ones don't — check your version.",
    docs_links: "[LINK: modelcontextprotocol.io server list]",
  },
  {
    title: "Wire Up the Postgres MCP Server (Read-Only)",
    slug: "wire-up-the-postgres-mcp-server-read-only",
    description: "Let an agent query a Postgres database's schema and run read-only SQL, without write access.",
    category: "mcp_server_setup",
    tags: ["mcp", "postgres", "sql"],
    setup_steps:
      "1. Create a dedicated Postgres role with SELECT-only grants on the schemas the agent needs — never point it at a role with write or DDL privileges. 2. Build a connection string for that role. 3. Add the postgres MCP server to the config with the connection string in an env var. 4. Verify: ask the agent to describe a table's schema, then confirm an attempted INSERT is rejected by the database, not just discouraged by the prompt.",
    config_snippet:
      '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]\n    }\n  }\n}',
    gotchas_notes:
      "The read-only guarantee has to come from the database role's grants, not the MCP server's behavior — a role with write access will let the agent write, regardless of how the server is described. Long-running or unindexed queries an agent generates can lock or slow a shared database; point this at a replica for anything beyond a small dev database.",
    docs_links: "[LINK: modelcontextprotocol.io server list] [LINK: Postgres GRANT docs]",
  },

  // ─── api_integration (2) ───────────────────────────────────────────
  {
    title: "Give an Agent Slack API Access via a Custom Tool",
    slug: "give-an-agent-slack-api-access-via-a-custom-tool",
    description: "Wire a Slack bot token into a custom tool so an agent can post messages and read channel history.",
    category: "api_integration",
    tags: ["api", "slack"],
    setup_steps:
      "1. Create a Slack app in the target workspace and add the bot scopes you actually need (chat:write, channels:history, etc. — not admin scopes). 2. Install the app to the workspace and copy the bot token (xoxb-...). 3. Store the token in a secrets manager or env var, never in code. 4. Implement a thin tool wrapper (post_message, read_channel_history) that calls the Slack Web API with the token, and register it with the agent. 5. Test with a message to a private test channel before pointing it at anything real.",
    config_snippet:
      'const res = await fetch("https://slack.com/api/chat.postMessage", {\n  method: "POST",\n  headers: {\n    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ channel, text }),\n});',
    gotchas_notes:
      "Slack's Tier-based rate limits (roughly 1 request/sec for chat.postMessage) mean a loop of agent-generated messages can get throttled fast — add backoff. A bot token's scopes apply everywhere it's installed; if the same app is installed in multiple workspaces, an over-broad scope reaches all of them.",
    docs_links: "[LINK: Slack Web API docs] [LINK: Slack app OAuth scopes reference]",
  },
  {
    title: "Give an Agent Read Access to a REST API Behind an API Key",
    slug: "give-an-agent-read-access-to-a-rest-api-behind-an-api-key",
    description: "General pattern for wrapping any GET-only REST API in a tool an agent can call safely.",
    category: "api_integration",
    tags: ["api", "rest"],
    setup_steps:
      "1. Get an API key scoped to read-only access if the provider supports it. 2. Store the key in an env var or secrets manager. 3. Write a tool function that takes a small, explicit set of parameters (not a raw URL the model constructs itself) and builds the request server-side. 4. Validate/allowlist any path or query parameter the model supplies before it reaches the request — never interpolate model output directly into the URL. 5. Register the tool with a description narrow enough that the agent only reaches for it for its intended purpose.",
    config_snippet:
      'async function lookupCompany(domain: string) {\n  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error("invalid domain");\n  const res = await fetch(`https://api.example.com/v1/company?domain=${encodeURIComponent(domain)}`, {\n    headers: { Authorization: `Bearer ${process.env.API_KEY}` },\n  });\n  return res.json();\n}',
    gotchas_notes:
      "The validation step is the actual security boundary — an agent that can pass an arbitrary string into a URL path can be steered into SSRF-style requests against internal endpoints if you don't allowlist input shape. Cache aggressively-called read endpoints; agents tend to re-fetch the same data across turns.",
    docs_links: "[LINK: OWASP SSRF prevention cheat sheet]",
  },

  // ─── auth_and_tool_use (2) ──────────────────────────────────────────
  {
    title: "Set Up OAuth for an Agent That Acts on a User's Behalf",
    slug: "set-up-oauth-for-an-agent-that-acts-on-a-users-behalf",
    description: "The standard OAuth 2.0 authorization-code-with-PKCE flow for an agent that needs per-user, revocable access.",
    category: "auth_and_tool_use",
    tags: ["oauth", "auth"],
    setup_steps:
      "1. Register an OAuth app with the provider (Google, Microsoft, GitHub, etc.), requesting only the scopes the agent's tools actually use. 2. Implement the authorization-code flow with PKCE — never the implicit flow, and never embed a client secret in anything that ships to an end user. 3. Store refresh tokens encrypted, associated with the user, not the agent process. 4. On each tool call, use the stored refresh token to mint a short-lived access token — don't reuse a long-lived token across many calls. 5. Build a revoke path so a user can cut off the agent's access without you having to redeploy anything.",
    config_snippet:
      "GET https://provider.example.com/oauth/authorize\n  ?response_type=code\n  &client_id=YOUR_CLIENT_ID\n  &redirect_uri=YOUR_REDIRECT_URI\n  &scope=read:calendar\n  &code_challenge=BASE64URL(SHA256(verifier))\n  &code_challenge_method=S256",
    gotchas_notes:
      "Scope creep is the biggest real risk here — an agent asking for 'read:calendar write:calendar admin' when it only ever reads is a standing liability, not a convenience. Refresh tokens can be silently revoked by the user or provider; a tool call must handle that as an expected error, not crash the agent's turn.",
    docs_links: "[LINK: OAuth 2.0 RFC 6749] [LINK: PKCE RFC 7636]",
  },
  {
    title: "Scope a Service-Account Key Down to What an Agent Actually Needs",
    slug: "scope-a-service-account-key-down-to-what-an-agent-actually-needs",
    description: "Checklist for issuing a service-account credential to an autonomous agent without over-granting it.",
    category: "auth_and_tool_use",
    tags: ["auth", "security"],
    setup_steps:
      "1. List every action the agent's tools will actually perform (e.g. 'read objects in bucket X', 'write to table Y') before touching IAM. 2. Create a role with exactly those permissions — start from zero, not from a broad preset role, and add only what's on the list. 3. Issue the credential to the agent's runtime environment via a secrets manager, not a checked-in key file. 4. Set an expiry or rotation schedule; long-lived unrotated agent credentials are a common real-world incident source. 5. Log every call the credential makes so a compromised or misbehaving agent is auditable after the fact.",
    config_snippet:
      '{\n  "role": "custom.agentReader",\n  "permissions": ["storage.objects.get", "storage.objects.list"],\n  "bindings": ["serviceAccount:agent-runner@project.iam"]\n}',
    gotchas_notes:
      "A broad preset role (\"Editor\", \"Owner\") is the single most common over-grant mistake — it's convenient during setup and then never gets narrowed. Treat any credential an agent holds as eventually-exposed: the blast radius of the permission set matters more than how carefully the key is currently stored.",
    docs_links: "[LINK: principle of least privilege — NIST]",
  },

  // ─── data_source_connector (2) ─────────────────────────────────────
  {
    title: "Connect an Agent to a Vector Database for Retrieval",
    slug: "connect-an-agent-to-a-vector-database-for-retrieval",
    description: "Wire up a retrieval tool backed by a vector database so an agent can ground answers in your own documents.",
    category: "data_source_connector",
    tags: ["rag", "vector-db", "retrieval"],
    setup_steps:
      "1. Chunk and embed your source documents with a consistent embedding model — the same model must be used at query time. 2. Upsert the vectors into the vector database with metadata (source, section, timestamp) attached to each chunk, not just the raw text. 3. Implement a retrieval tool that embeds the incoming query, searches for the top-k nearest chunks, and returns them with their source metadata. 4. Register the tool with the agent and instruct it to cite the returned sources rather than answering from parametric memory when the tool is available. 5. Re-index on a schedule or on document change so retrieval doesn't silently go stale.",
    config_snippet:
      "const queryVec = await embed(query);\nconst results = await vectorDb.query({\n  vector: queryVec,\n  topK: 5,\n  includeMetadata: true,\n});",
    gotchas_notes:
      "Embedding-model drift is a real failure mode — re-embedding your corpus with a different model than the one used at query time silently degrades relevance without an obvious error. Chunk size trades off precision (small chunks) against context (large chunks); test with real queries rather than guessing a default.",
    docs_links: "[LINK: vector database provider docs — pick your provider] [LINK: RAG chunking strategies overview]",
  },
  {
    title: "Connect an Agent to a Read-Only Data Warehouse Table",
    slug: "connect-an-agent-to-a-read-only-data-warehouse-table",
    description: "Give an agent safe, read-only access to a specific warehouse table or view for analytics questions.",
    category: "data_source_connector",
    tags: ["data-warehouse", "sql", "analytics"],
    setup_steps:
      "1. Create a view exposing only the columns and rows the agent should see — never grant it the underlying raw table if it contains PII or unrelated data. 2. Create a role with SELECT-only access to that view, nothing else. 3. Set a query timeout and row-limit at the role or warehouse level so a runaway agent-generated query can't scan the whole warehouse. 4. Wire a query tool that runs against this role's credentials specifically, distinct from any credential used elsewhere in the app. 5. Log every query the agent runs against the view for later audit.",
    config_snippet:
      "CREATE VIEW agent_readable_orders AS\n  SELECT order_id, region, amount, created_at\n  FROM orders\n  WHERE amount IS NOT NULL;\n\nGRANT SELECT ON agent_readable_orders TO agent_reader;",
    gotchas_notes:
      "A view is only a real boundary if the underlying grants don't also let the role touch the base table directly — double-check the role has no other grants. An agent given a general 'run SQL' tool instead of a fixed set of queries can construct expensive scans; a row/timeout limit at the warehouse level is the actual backstop, not the agent's own judgment.",
    docs_links: "[LINK: your warehouse's GRANT/role documentation]",
  },

  // ─── browser_automation (1) ─────────────────────────────────────────
  {
    title: "Wire Up a Headless Browser Tool for Web Reading",
    slug: "wire-up-a-headless-browser-tool-for-web-reading",
    description: "Give an agent a controlled way to fetch and read live web pages via a headless browser, not raw fetch.",
    category: "browser_automation",
    tags: ["browser", "automation", "scraping"],
    setup_steps:
      "1. Stand up a headless browser (Playwright or Puppeteer) behind a tool interface with a small, fixed action set — navigate, get_text, click, screenshot — not free-form script execution. 2. Set a strict per-page timeout and a total-request budget per agent turn to bound cost and runaway loops. 3. Block navigation to internal/private IP ranges at the tool layer, not just by prompting the agent not to go there. 4. Return extracted text/structured data to the agent, not raw HTML, to keep context usage down. 5. Respect robots.txt and site terms for anything beyond one-off manual testing.",
    config_snippet:
      "const browser = await chromium.launch({ headless: true });\nconst page = await browser.newPage();\nawait page.goto(url, { timeout: 15000 });\nconst text = await page.innerText('body');\nawait browser.close();",
    gotchas_notes:
      "Blocking internal IP ranges (127.0.0.1, 169.254.169.254 cloud metadata, RFC1918 ranges) at the tool layer is the real SSRF defense — an agent that can be steered to navigate anywhere the browser process's network can reach is a serious risk without this. Pages with heavy client-side rendering need an explicit wait-for-selector, not a fixed sleep, or the agent reads a half-rendered page.",
    docs_links: "[LINK: Playwright docs] [LINK: OWASP SSRF prevention cheat sheet]",
  },

  // ─── mcp_server_setup (+3) — from the Phase 2b seed research pass, see
  // plan-phase-2-...md. Vendor-hosted remote servers, distinct setup shape
  // from the local stdio servers above.
  {
    title: "Wire Up the Sentry MCP Server",
    slug: "wire-up-the-sentry-mcp-server",
    description: "Give an agent read access to Sentry issues and error data via Sentry's official hosted MCP server.",
    category: "mcp_server_setup",
    tags: ["mcp", "sentry", "observability"],
    setup_steps:
      "1. Confirm your agent client supports remote MCP servers over OAuth (not just local stdio). 2. Add Sentry's hosted MCP endpoint to your agent's MCP config. 3. On first use, complete the OAuth consent flow in the browser it opens — this scopes access to the specific Sentry org/projects you approve, not your whole Sentry account. 4. Verify by asking the agent to list recent unresolved issues in a known project.",
    config_snippet:
      '{\n  "mcpServers": {\n    "sentry": {\n      "url": "https://mcp.sentry.dev/mcp"\n    }\n  }\n}',
    gotchas_notes:
      "This server can trigger Seer, Sentry's AI root-cause analysis tool — that's a real API cost/quota action, not just a read, so an agent that reaches for it liberally can burn through Seer usage faster than expected. Consent is scoped per Sentry org at OAuth time; if you need access to a second org, you'll go through the consent flow again rather than it silently extending.",
    docs_links: "[LINK: github.com/getsentry/sentry-mcp] [LINK: Sentry MCP server docs]",
  },
  {
    title: "Wire Up the Linear MCP Server",
    slug: "wire-up-the-linear-mcp-server",
    description: "Let an agent read and update Linear issues via Linear's official hosted MCP server — remote-only now.",
    category: "mcp_server_setup",
    tags: ["mcp", "linear", "project-management"],
    setup_steps:
      "1. Confirm your agent client supports remote MCP over OAuth. 2. Add Linear's hosted MCP endpoint to your config — there is no supported local/stdio Linear server; the older community one is explicitly deprecated. 3. Complete the OAuth consent flow, which scopes access to the specific Linear workspace you approve. 4. Verify by asking the agent to list your open issues in one team.",
    config_snippet:
      '{\n  "mcpServers": {\n    "linear": {\n      "url": "https://mcp.linear.app/mcp"\n    }\n  }\n}',
    gotchas_notes:
      "If you find a local/stdio Linear MCP setup guide online, treat it as stale — Linear moved to hosted-remote-only and the old community server is a dead end. An agent with write access can create/update issues on your behalf; scope the OAuth consent to only the teams/workspaces you actually want it touching.",
    docs_links: "[LINK: linear.app/docs/mcp]",
  },
  {
    title: "Wire Up the Supabase MCP Server (Read-Only)",
    slug: "wire-up-the-supabase-mcp-server-read-only",
    description: "Let an agent inspect a Supabase project's schema and data via the official server, locked to read-only.",
    category: "mcp_server_setup",
    tags: ["mcp", "supabase", "postgres"],
    setup_steps:
      "1. Generate a Supabase personal access token scoped to the specific project the agent needs, not your whole account. 2. Add the official Supabase MCP server to your config with the `--read-only` flag set. 3. Restart the client. 4. Verify: ask the agent to list tables and describe a schema, then confirm an attempted write is actually rejected — don't just trust the flag's name.",
    config_snippet:
      '{\n  "mcpServers": {\n    "supabase": {\n      "command": "npx",\n      "args": ["-y", "@supabase/mcp-server-supabase", "--project-ref=<project-ref>", "--read-only"],\n      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" }\n    }\n  }\n}',
    gotchas_notes:
      "A known open issue: `tools/list` still advertises mutating tools (like `apply_migration`) even with `--read-only` set — the tool appears available even though calling it will actually fail. Don't rely on the tool list itself to prove read-only is enforced; verify by attempting a write and confirming it's rejected.",
    docs_links: "[LINK: github.com/supabase/mcp] [LINK: @supabase/mcp-server-supabase on npm]",
  },

  // ─── api_integration (+4) ──────────────────────────────────────────
  {
    title: "Wire Up the Stripe MCP Server",
    slug: "wire-up-the-stripe-mcp-server",
    description: "Give an agent access to Stripe data/actions via the official hosted MCP server, scoped to a restricted key.",
    category: "api_integration",
    tags: ["mcp", "stripe", "payments"],
    setup_steps:
      "1. In the Stripe dashboard, create a restricted API key scoped to only the specific resources the agent needs (e.g. read-only on Customers and Charges) — never use an unrestricted secret key. 2. Add Stripe's hosted MCP server to your config. 3. Authenticate via the OAuth flow it presents, or the restricted key depending on your client's support. 4. Verify by asking the agent to look up a known test-mode customer before ever pointing it at live data.",
    config_snippet:
      '{\n  "mcpServers": {\n    "stripe": {\n      "url": "https://mcp.stripe.com"\n    }\n  }\n}',
    gotchas_notes:
      "This server is genuinely live-payments-capable — running it with an unrestricted live secret key against an agent is a real financial risk, not a theoretical one. Test everything against Stripe's test mode first, and only grant live-mode, write-capable scopes if the agent's actual job requires taking payment actions, not just reading data.",
    docs_links: "[LINK: mcp.stripe.com] [LINK: Stripe restricted API keys docs]",
  },
  {
    title: "Wire Up the Figma Dev Mode MCP Server",
    slug: "wire-up-the-figma-dev-mode-mcp-server",
    description: "Let a coding agent read a Figma file's structure and design tokens via Figma's local Dev Mode server.",
    category: "api_integration",
    tags: ["mcp", "figma", "design"],
    setup_steps:
      "1. Open the target file in the Figma desktop app (not the browser) with a Professional plan or above. 2. Toggle Dev Mode on for that specific file — the local server only serves files with Dev Mode explicitly enabled. 3. Add the local Dev Mode MCP endpoint to your agent config. 4. Verify by asking the agent to describe a specific frame's layout and design tokens while the file stays open in Figma.",
    config_snippet:
      '{\n  "mcpServers": {\n    "figma-dev-mode": {\n      "url": "http://127.0.0.1:3845/mcp"\n    }\n  }\n}',
    gotchas_notes:
      "This is not a general Figma API integration — it requires an active Figma desktop session with that specific file open and Dev Mode toggled on. If it silently returns nothing useful, the most common cause is Dev Mode not being enabled for that file, not a config problem.",
    docs_links: "[LINK: developers.figma.com/docs/figma-mcp-server/local-server-installation]",
  },
  {
    title: "Wire Up the Vercel MCP Server",
    slug: "wire-up-the-vercel-mcp-server",
    description: "Let an agent inspect and manage Vercel deployments/projects via the official hosted MCP server.",
    category: "api_integration",
    tags: ["mcp", "vercel", "deployments"],
    setup_steps:
      "1. Add Vercel's hosted MCP server to your agent config. 2. Complete the OAuth consent flow, scoping access to a specific team/project rather than your whole Vercel account. 3. Verify by asking the agent to list recent deployments for one project before granting it anything beyond read access.",
    config_snippet:
      '{\n  "mcpServers": {\n    "vercel": {\n      "url": "https://mcp.vercel.com"\n    }\n  }\n}',
    gotchas_notes:
      "This server can trigger real deployments and project changes, not just report status — scope the OAuth consent to a single team/project you actually want the agent acting on, and treat any deployment-triggering capability as a genuinely consequential action, not a read.",
    docs_links: "[LINK: vercel.com/docs/mcp/vercel-mcp]",
  },
  {
    title: "Wire Up the Cloudflare MCP Servers",
    slug: "wire-up-the-cloudflare-mcp-servers",
    description: "Give an agent access to specific Cloudflare products (Workers, KV, D1) via Cloudflare's official MCP servers.",
    category: "api_integration",
    tags: ["mcp", "cloudflare", "infra"],
    setup_steps:
      "1. Identify which specific Cloudflare products the agent actually needs (Workers, KV, D1, etc.) — Cloudflare ships separate sub-servers per product area, not one server for everything. 2. Create an API token scoped to only those products' permissions. 3. Add the relevant sub-server(s) to your agent config, each with its own token if scopes differ. 4. Verify each sub-server independently before combining them.",
    config_snippet:
      '{\n  "mcpServers": {\n    "cloudflare-workers": {\n      "command": "npx",\n      "args": ["-y", "@cloudflare/mcp-server-cloudflare", "run", "workers"],\n      "env": { "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}" }\n    }\n  }\n}',
    gotchas_notes:
      "One broad API token doesn't cover every Cloudflare product area — a token scoped for Workers won't necessarily work for KV or D1. Set up and test each sub-server's own token rather than assuming a single credential covers the whole catalog.",
    docs_links: "[LINK: github.com/cloudflare/mcp-server-cloudflare] [LINK: github.com/cloudflare/workers-mcp]",
  },

  // ─── auth_and_tool_use (+3) ──────────────────────────────────────────
  {
    title: "Set Up OAuth Device Authorization Grant for a Headless Agent",
    slug: "set-up-oauth-device-authorization-grant-for-a-headless-agent",
    description: "Authorize a CLI or headless agent against a SaaS API without a localhost browser callback, via RFC 8628.",
    category: "auth_and_tool_use",
    tags: ["oauth", "cli"],
    setup_steps:
      "1. Confirm the provider supports the device authorization grant (RFC 8628) — check their OAuth docs for a 'device code' or 'device flow' endpoint. 2. From the headless/CLI agent, request a device code and user code from the provider's device-authorization endpoint. 3. Display the user code and verification URL to the person running the agent; they approve it on a separate device with a browser. 4. Poll the token endpoint until the user completes approval, then store the resulting token the same way you would any OAuth token.",
    config_snippet:
      "POST https://provider.example.com/oauth/device/code\n  client_id=YOUR_CLIENT_ID\n  scope=read:resource\n\n# Response includes device_code, user_code, verification_uri, interval\n# Then poll:\nPOST https://provider.example.com/oauth/token\n  grant_type=urn:ietf:params:oauth:grant-type:device_code\n  device_code=...\n  client_id=YOUR_CLIENT_ID",
    gotchas_notes:
      "Respect the provider's returned polling interval — polling faster than instructed commonly triggers rate-limiting or a slow_down error. The user code has a real expiry (often 10-15 minutes); if the agent's process dies mid-flow, the code can't be resumed and the flow has to restart from scratch.",
    docs_links: "[LINK: RFC 8628 — OAuth 2.0 Device Authorization Grant]",
  },
  {
    title: "Use a Client-Credentials Grant for a Fully Autonomous Agent",
    slug: "use-a-client-credentials-grant-for-a-fully-autonomous-agent",
    description: "Authenticate a scheduled, no-human-in-the-loop agent job as itself, distinct from user-delegated OAuth.",
    category: "auth_and_tool_use",
    tags: ["oauth", "auth"],
    setup_steps:
      "1. Register a dedicated client (not a shared one used elsewhere) for this specific autonomous job, so its access can be revoked independently. 2. Request only the scopes the scheduled job's actual actions require — this credential has no human approving each action, so over-scoping here has a wider blast radius than a user-delegated token. 3. Store the client secret in a secrets manager, never in the job's own repo or config file. 4. Set a rotation schedule for the secret, since there's no user re-consenting periodically to naturally force rotation the way OAuth refresh flows sometimes do.",
    config_snippet:
      "POST https://provider.example.com/oauth/token\n  grant_type=client_credentials\n  client_id=YOUR_CLIENT_ID\n  client_secret=YOUR_CLIENT_SECRET\n  scope=write:specific-resource",
    gotchas_notes:
      "Because no human approves each individual action with this grant, the scope you request at registration time is the actual, permanent ceiling on what the job can do — treat scope selection as the real security control, not a formality. A leaked client-credentials secret is immediately as powerful as the job itself, with no session or user context to further limit it.",
    docs_links: "[LINK: OAuth 2.0 RFC 6749 — Client Credentials Grant]",
  },
  {
    title: "Wire Up a Remote MCP Server With OAuth 2.1 + PKCE Consent",
    slug: "wire-up-a-remote-mcp-server-with-oauth-21-pkce-consent",
    description: "The general pattern behind GitHub/Linear/Sentry/Stripe/Figma/Vercel's hosted MCP servers — distinct from a local stdio server.",
    category: "auth_and_tool_use",
    tags: ["mcp", "oauth"],
    setup_steps:
      "1. Point your agent client's MCP config at the provider's hosted HTTPS endpoint rather than a local command. 2. On first connection, the client should open a browser to the provider's consent screen — if it doesn't, your client may not support remote MCP over OAuth yet, and no amount of config will fix that. 3. Approve only the specific scopes/resources shown on the consent screen, not blanket account access if the screen offers a narrower option. 4. The client stores the resulting token and refreshes it automatically; re-running the OAuth flow is only needed if the token is revoked or scopes change.",
    config_snippet:
      '{\n  "mcpServers": {\n    "example": {\n      "url": "https://mcp.example-provider.com/mcp"\n    }\n  }\n}',
    gotchas_notes:
      "This is a genuinely different setup shape from a local stdio server with an env-var API key — there's no token to copy-paste, and a setup guide written for local servers won't transfer. If your agent client is older or minimal, it may simply not support the OAuth consent flow yet, which looks like a silent connection failure rather than a clear error.",
    docs_links: "[LINK: OAuth 2.1 draft spec] [LINK: RFC 7636 — PKCE]",
  },

  // ─── data_source_connector (+2) ─────────────────────────────────────
  {
    title: "Wire Up the AWS MCP Servers for Docs and Knowledge Lookup",
    slug: "wire-up-the-aws-mcp-servers-for-docs-and-knowledge-lookup",
    description: "Give an agent grounded AWS documentation/knowledge lookup via AWS Labs' official MCP servers.",
    category: "data_source_connector",
    tags: ["mcp", "aws"],
    setup_steps:
      "1. Pick the specific sub-server(s) you need from the AWS Labs MCP monorepo — it's organized into tiers (Essential vs. Core), not one server for all of AWS. 2. Configure AWS credentials scoped to read-only, least-privilege access for whatever the chosen sub-server actually touches. 3. Add the sub-server(s) to your agent config. 4. Verify with a documentation lookup query before relying on it for anything account-specific.",
    config_snippet:
      '{\n  "mcpServers": {\n    "aws-docs": {\n      "command": "uvx",\n      "args": ["awslabs.aws-documentation-mcp-server@latest"]\n    }\n  }\n}',
    gotchas_notes:
      "AWS has been actively steering production agent use toward a newer 'Agent Toolkit for AWS' rather than these MCP servers — treat this integration as good for exploration and documentation lookup today, not as the durable long-term path for account-acting agents. Don't grant broader-than-read AWS credentials to a documentation-lookup use case.",
    docs_links: "[LINK: github.com/awslabs/mcp]",
  },
  {
    title: "Wire Up the Kubernetes MCP Server",
    slug: "wire-up-the-kubernetes-mcp-server",
    description: "Let an agent inspect (or, if scoped, act on) a Kubernetes cluster via a native, kubeconfig-aware MCP server.",
    category: "data_source_connector",
    tags: ["mcp", "kubernetes", "infra"],
    setup_steps:
      "1. Create a kubeconfig context scoped to exactly the cluster and namespace(s) the agent should touch — never point it at a config with every cluster you have access to. 2. Explicitly pin the active context rather than relying on whatever the default happens to be. 3. Add the Kubernetes MCP server to your agent config, pointing at that specific kubeconfig. 4. Verify by asking the agent to list pods in the intended namespace and confirming it can't see resources outside it.",
    config_snippet:
      '{\n  "mcpServers": {\n    "kubernetes": {\n      "command": "kubernetes-mcp-server",\n      "args": ["--kubeconfig", "/path/to/scoped-kubeconfig"]\n    }\n  }\n}',
    gotchas_notes:
      "This server talks directly to whatever cluster context is active — if the default context in the supplied kubeconfig isn't pinned explicitly, an agent can silently operate against the wrong cluster (e.g. production instead of staging) with no warning. Multi-cluster kubeconfigs are convenient for a human and dangerous for an agent; use a single-context, single-namespace config instead.",
    docs_links: "[LINK: github.com/containers/kubernetes-mcp-server]",
  },

  // ─── browser_automation (+2) ─────────────────────────────────────────
  {
    title: "Wire Up the Playwright MCP Server",
    slug: "wire-up-the-playwright-mcp-server",
    description: "Give an agent structured browser automation via accessibility snapshots, without needing a vision model.",
    category: "browser_automation",
    tags: ["mcp", "playwright", "browser"],
    setup_steps:
      "1. Add Microsoft's official Playwright MCP server to your agent config. 2. Separately run `npx playwright install chromium` (or the browser you need) — the MCP package doesn't bundle the browser binary itself. 3. Restart the client. 4. Verify by asking the agent to navigate to a known page and describe its structure via the accessibility snapshot, not a screenshot.",
    config_snippet:
      '{\n  "mcpServers": {\n    "playwright": {\n      "command": "npx",\n      "args": ["-y", "@playwright/mcp"]\n    }\n  }\n}',
    gotchas_notes:
      "The accessibility-snapshot approach means it works without a vision-capable model, but it also means pages with poor semantic markup (divs-as-buttons with no ARIA role) are genuinely harder for the agent to interact with correctly — that's a real limitation of the approach, not a bug. Browser state (cookies, login sessions) isn't sandboxed from the host machine by default.",
    docs_links: "[LINK: npmjs.com/package/@playwright/mcp]",
  },
  {
    title: "Give an Agent Its Own Browser-Extension Session",
    slug: "give-an-agent-its-own-browser-extension-session",
    description: "Let an agent drive a user's real, already-logged-in browser via an extension, instead of holding separate credentials.",
    category: "browser_automation",
    tags: ["browser", "extension"],
    setup_steps:
      "1. Install the agent's browser extension in the user's actual browser profile — this pattern only makes sense when the agent should act as the signed-in user, not as an independent service. 2. Confirm the extension's permission scope covers only the sites/actions actually needed, not blanket all-sites access if a narrower option exists. 3. Have the user explicitly grant the extension access when prompted, rather than pre-approving broadly. 4. Verify by having the agent read a page that requires the user's existing login, confirming it inherits the session correctly.",
    config_snippet:
      "// No API key or OAuth token to configure — the extension inherits\n// the browser's existing cookies/session for whatever site the\n// user is signed into. Nothing to store server-side.",
    gotchas_notes:
      "The security model here is fundamentally different from every other pattern in this section: the agent isn't holding its own credential at all, it's borrowing the user's live session — so 'least privilege' means restricting which sites/tabs the extension can act on, not scoping an API token. This also means the agent can only do what the signed-in user could do by hand, which is a real safety property worth stating explicitly to users.",
    docs_links: "[LINK: your browser's extension permissions documentation]",
  },

  // ─── other (+2) ──────────────────────────────────────────────────────
  {
    title: "Understand the Agent2Agent (A2A) Protocol Basics",
    slug: "understand-the-agent2agent-a2a-protocol-basics",
    description: "The open protocol for agent-to-agent task delegation and discovery — complements MCP, doesn't replace it.",
    category: "other",
    tags: ["a2a", "agent-to-agent"],
    setup_steps:
      "1. Understand the split first: MCP connects one agent to tools/data sources; A2A connects one agent to another agent for task delegation and discovery — they solve different problems and are often used together, not as alternatives. 2. Publish (or look up) an Agent Card — a signed, discoverable description of what an agent can do and how to reach it. 3. To delegate a task to another agent, send it a task request referencing its Agent Card's declared capabilities, not an assumed API shape. 4. Handle the response asynchronously — A2A tasks are commonly long-running, not a synchronous request/reply.",
    config_snippet:
      '{\n  "name": "example-agent",\n  "capabilities": ["summarize-document", "draft-email"],\n  "endpoint": "https://agent.example.com/a2a",\n  "signature": "..."\n}',
    gotchas_notes:
      "Don't reach for A2A when what you actually need is MCP (an agent calling a tool) — they're commonly conflated, but A2A is specifically for one agent delegating to another autonomous agent. Agent Cards are signed for a reason: verify a card's signature before trusting its declared capabilities, the same way you'd verify any other credential before acting on it.",
    docs_links: "[LINK: github.com/a2aproject/A2A]",
  },
  {
    title: "Run MCP Servers in a Sandboxed Container via Docker's MCP Toolkit",
    slug: "run-mcp-servers-in-a-sandboxed-container-via-dockers-mcp-toolkit",
    description: "Run untrusted or third-party MCP servers as isolated containers instead of raw `npx -y` on the host.",
    category: "other",
    tags: ["docker", "security", "mcp"],
    setup_steps:
      "1. Install Docker Desktop with the MCP Toolkit enabled. 2. Browse the MCP Catalog for the server you need rather than running an arbitrary npm package directly on the host — the catalog includes curated partner servers (Stripe, Elastic, Grafana, Neo4j, and others) already packaged this way. 3. Launch the server through the Toolkit rather than `npx`, so it runs in its own container with its own filesystem/network boundary. 4. Point your agent config at the Toolkit's local gateway rather than a directly-spawned process.",
    config_snippet:
      '{\n  "mcpServers": {\n    "toolkit-gateway": {\n      "command": "docker",\n      "args": ["mcp", "gateway", "run"]\n    }\n  }\n}',
    gotchas_notes:
      "This pattern exists specifically to address the real supply-chain risk of `npx -y some-untrusted-package` as your MCP transport — a compromised package published to npm runs directly on your host with that pattern, but stays contained when run through the Toolkit. The catalog is read-only; if you need a private or customized entry, you fork it rather than editing in place.",
    docs_links: "[LINK: docs.docker.com/ai/mcp-catalog-and-toolkit/]",
  },
];
