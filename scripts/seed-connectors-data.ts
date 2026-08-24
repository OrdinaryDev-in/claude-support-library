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
];
