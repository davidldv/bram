# Bram Backend Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a thin, stateless HTTP proxy that holds the Claude and news API keys and exposes `/chat` and `/news` to the Bram mobile app, storing nothing.

**Architecture:** A small Express + TypeScript service. All outbound integrations (Claude, news) are wrapped behind injectable interfaces so routes can be tested with fakes and no network. `createApp(deps)` builds the app from injected dependencies; `index.ts` wires the real clients and starts the server. No database, no sessions, no personal-data persistence.

**Tech Stack:** Node.js, TypeScript, Express, `@anthropic-ai/sdk`, `express-rate-limit`, Vitest + Supertest for tests.

---

## File Structure

- `package.json`, `tsconfig.json`, `vitest.config.ts` — project setup
- `.env.example` — required env vars (no secrets committed)
- `src/config.ts` — load + validate env into a typed `Config`
- `src/services/news.ts` — `NewsClient` interface + `createNewsClient` (wraps news API via injectable `fetch`)
- `src/services/llm.ts` — `LlmClient` interface + `createLlmClient` (wraps Claude via injectable SDK)
- `src/routes/news.ts` — `newsRouter(news)` → `POST /news`
- `src/routes/chat.ts` — `chatRouter(llm, maxTokens)` → `POST /chat`
- `src/server.ts` — `createApp(deps)` wires middleware + routers + `/health`
- `src/index.ts` — entry point: load config, build real clients, listen
- `tests/*.test.ts` — one test file per unit

**API contracts**

- `POST /news` — body `{ topics: string[] }` → `200 { headlines: {title, source, url}[] }`; `502 { error: "news_unavailable" }`
- `POST /chat` — body `{ system: string, messages: {role:"user"|"assistant", content:string}[] }` → `200 { reply: string }`; `400 { error: "invalid_request" }`; `502 { error: "llm_unavailable" }`
- `GET /health` → `200 { ok: true }`

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bram-proxy",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
NEWS_API_KEY=xxxxx
CLAUDE_MODEL=claude-haiku-4-5-20251001
PORT=3000
RATE_LIMIT_MAX=30
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
.env
```

- [ ] **Step 6: Install and verify**

Run: `npm install && npx vitest run`
Expected: install succeeds; Vitest reports "No test files found" (exit 0 or "no tests"). This confirms toolchain works.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example .gitignore package-lock.json
git commit -m "chore: scaffold bram backend proxy"
```

---

## Task 1: Config loader

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("loads valid env with defaults", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "a", NEWS_API_KEY: "n" });
    expect(cfg.anthropicApiKey).toBe("a");
    expect(cfg.newsApiKey).toBe("n");
    expect(cfg.model).toBe("claude-haiku-4-5-20251001");
    expect(cfg.port).toBe(3000);
    expect(cfg.rateLimitMax).toBe(30);
  });

  it("throws when ANTHROPIC_API_KEY is missing", () => {
    expect(() => loadConfig({ NEWS_API_KEY: "n" })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("throws when NEWS_API_KEY is missing", () => {
    expect(() => loadConfig({ ANTHROPIC_API_KEY: "a" })).toThrow(/NEWS_API_KEY/);
  });

  it("respects overrides", () => {
    const cfg = loadConfig({
      ANTHROPIC_API_KEY: "a", NEWS_API_KEY: "n",
      CLAUDE_MODEL: "claude-sonnet-4-6", PORT: "8080", RATE_LIMIT_MAX: "5",
    });
    expect(cfg.model).toBe("claude-sonnet-4-6");
    expect(cfg.port).toBe(8080);
    expect(cfg.rateLimitMax).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — cannot find module `../src/config`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config.ts
export interface Config {
  anthropicApiKey: string;
  newsApiKey: string;
  model: string;
  port: number;
  rateLimitMax: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  const newsApiKey = env.NEWS_API_KEY;
  if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required");
  if (!newsApiKey) throw new Error("NEWS_API_KEY is required");
  return {
    anthropicApiKey,
    newsApiKey,
    model: env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001",
    port: Number(env.PORT ?? 3000),
    rateLimitMax: Number(env.RATE_LIMIT_MAX ?? 30),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: typed config loader with validation"
```

---

## Task 2: News service

**Files:**
- Create: `src/services/news.ts`
- Test: `tests/news.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createNewsClient } from "../src/services/news";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("createNewsClient", () => {
  it("maps provider articles to headlines", async () => {
    const fetchFn = vi.fn(async () =>
      fakeResponse({
        articles: [
          { title: "T1", source: { name: "S1" }, url: "http://a" },
          { title: "T2", source: { name: "S2" }, url: "http://b" },
        ],
      })
    );
    const client = createNewsClient({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });

    const headlines = await client.fetchHeadlines(["tech"]);

    expect(headlines).toEqual([
      { title: "T1", source: "S1", url: "http://a" },
      { title: "T2", source: "S2", url: "http://b" },
    ]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("throws when provider returns non-ok", async () => {
    const fetchFn = vi.fn(async () => fakeResponse({}, false, 500));
    const client = createNewsClient({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.fetchHeadlines(["tech"])).rejects.toThrow(/news provider error: 500/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/news.service.test.ts`
Expected: FAIL — cannot find module `../src/services/news`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/news.ts
export interface Headline {
  title: string;
  source: string;
  url: string;
}

export interface NewsClient {
  fetchHeadlines(topics: string[]): Promise<Headline[]>;
}

interface ProviderArticle {
  title: string;
  source: { name: string };
  url: string;
}

export function createNewsClient(opts: {
  apiKey: string;
  fetchFn?: typeof fetch;
}): NewsClient {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async fetchHeadlines(topics) {
      const query = topics.length ? topics.join(" OR ") : "top";
      const url =
        `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(query)}` +
        `&pageSize=5&apiKey=${opts.apiKey}`;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`news provider error: ${res.status}`);
      const data = (await res.json()) as { articles: ProviderArticle[] };
      return data.articles.map((a) => ({
        title: a.title,
        source: a.source.name,
        url: a.url,
      }));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/news.service.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/news.ts tests/news.service.test.ts
git commit -m "feat: news client wrapping headlines provider"
```

---

## Task 3: `/news` route

**Files:**
- Create: `src/routes/news.ts`, `src/server.ts`
- Test: `tests/news.route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { Headline, NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubLlm: LlmClient = { chat: async () => "unused" };

function appWithNews(news: NewsClient) {
  return createApp({ llm: stubLlm, news, maxTokens: 256 });
}

describe("POST /news", () => {
  it("returns headlines from the client", async () => {
    const headlines: Headline[] = [{ title: "T", source: "S", url: "http://a" }];
    const news: NewsClient = { fetchHeadlines: async () => headlines };

    const res = await request(appWithNews(news)).post("/news").send({ topics: ["tech"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ headlines });
  });

  it("returns 502 when the news client throws", async () => {
    const news: NewsClient = { fetchHeadlines: async () => { throw new Error("down"); } };

    const res = await request(appWithNews(news)).post("/news").send({ topics: ["tech"] });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "news_unavailable" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/news.route.test.ts`
Expected: FAIL — cannot find module `../src/server`.

- [ ] **Step 3: Write the news router**

```ts
// src/routes/news.ts
import { Router } from "express";
import type { NewsClient } from "../services/news";

export function newsRouter(news: NewsClient): Router {
  const r = Router();
  r.post("/news", async (req, res) => {
    const topics = Array.isArray(req.body?.topics) ? req.body.topics : [];
    try {
      const headlines = await news.fetchHeadlines(topics);
      res.json({ headlines });
    } catch {
      res.status(502).json({ error: "news_unavailable" });
    }
  });
  return r;
}
```

- [ ] **Step 4: Write `createApp` (minimal, news only for now)**

```ts
// src/server.ts
import express, { type RequestHandler } from "express";
import { newsRouter } from "./routes/news";
import type { NewsClient } from "./services/news";
import type { LlmClient } from "./services/llm";

export interface AppDeps {
  llm: LlmClient;
  news: NewsClient;
  maxTokens: number;
  rateLimit?: RequestHandler;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  if (deps.rateLimit) app.use(deps.rateLimit);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(newsRouter(deps.news));
  return app;
}
```

- [ ] **Step 5: Create the LlmClient type stub so the import resolves**

```ts
// src/services/llm.ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmClient {
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/news.route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/routes/news.ts src/server.ts src/services/llm.ts tests/news.route.test.ts
git commit -m "feat: POST /news route with createApp wiring"
```

---

## Task 4: LLM service (Claude)

**Files:**
- Modify: `src/services/llm.ts`
- Test: `tests/llm.service.test.ts`

> **Note:** Before implementing, confirm the current `@anthropic-ai/sdk` `messages.create` shape and the exact model id using the `claude-api` skill. The code below reflects the stable SDK surface; adjust the import/shape only if the skill says otherwise.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createLlmClient } from "../src/services/llm";

describe("createLlmClient", () => {
  it("sends system + messages and returns joined text", async () => {
    const create = vi.fn(async () => ({
      content: [
        { type: "text", text: "Good " },
        { type: "text", text: "morning." },
      ],
    }));
    const anthropic = { messages: { create } } as any;

    const client = createLlmClient({ apiKey: "k", model: "claude-haiku-4-5-20251001", anthropic });
    const reply = await client.chat("be brief", [{ role: "user", content: "hi" }], 256);

    expect(reply).toBe("Good morning.");
    expect(create).toHaveBeenCalledWith({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/llm.service.test.ts`
Expected: FAIL — `createLlmClient` is not exported.

- [ ] **Step 3: Implement `createLlmClient` (extend existing file)**

Replace the contents of `src/services/llm.ts` with:

```ts
// src/services/llm.ts
import Anthropic from "@anthropic-ai/sdk";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmClient {
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}

export function createLlmClient(opts: {
  apiKey: string;
  model: string;
  anthropic?: Anthropic;
}): LlmClient {
  const client = opts.anthropic ?? new Anthropic({ apiKey: opts.apiKey });
  return {
    async chat(system, messages, maxTokens) {
      const res = await client.messages.create({
        model: opts.model,
        max_tokens: maxTokens,
        system,
        messages,
      });
      return res.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/llm.service.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS — config, news service, news route, llm service all green.

- [ ] **Step 6: Commit**

```bash
git add src/services/llm.ts tests/llm.service.test.ts
git commit -m "feat: Claude LLM client wrapper"
```

---

## Task 5: `/chat` route

**Files:**
- Create: `src/routes/chat.ts`
- Modify: `src/server.ts`
- Test: `tests/chat.route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubNews: NewsClient = { fetchHeadlines: async () => [] };

function appWithLlm(llm: LlmClient) {
  return createApp({ llm, news: stubNews, maxTokens: 256 });
}

describe("POST /chat", () => {
  it("returns the model reply", async () => {
    const llm: LlmClient = { chat: async () => "Hello, David." };
    const res = await request(appWithLlm(llm))
      .post("/chat")
      .send({ system: "be brief", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Hello, David." });
  });

  it("returns 400 on invalid body", async () => {
    const llm: LlmClient = { chat: async () => "unused" };
    const res = await request(appWithLlm(llm)).post("/chat").send({ messages: "nope" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
  });

  it("returns 502 when the model throws", async () => {
    const llm: LlmClient = { chat: async () => { throw new Error("down"); } };
    const res = await request(appWithLlm(llm))
      .post("/chat")
      .send({ system: "x", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "llm_unavailable" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chat.route.test.ts`
Expected: FAIL — cannot find module `../src/routes/chat`.

- [ ] **Step 3: Write the chat router**

```ts
// src/routes/chat.ts
import { Router } from "express";
import type { LlmClient, ChatMessage } from "../services/llm";

export function chatRouter(llm: LlmClient, maxTokens: number): Router {
  const r = Router();
  r.post("/chat", async (req, res) => {
    const { system, messages } = req.body ?? {};
    if (typeof system !== "string" || !Array.isArray(messages)) {
      return res.status(400).json({ error: "invalid_request" });
    }
    try {
      const reply = await llm.chat(system, messages as ChatMessage[], maxTokens);
      res.json({ reply });
    } catch {
      res.status(502).json({ error: "llm_unavailable" });
    }
  });
  return r;
}
```

- [ ] **Step 4: Wire the chat router into `createApp`**

In `src/server.ts`, add the import and mount it. The import block becomes:

```ts
import express, { type RequestHandler } from "express";
import { newsRouter } from "./routes/news";
import { chatRouter } from "./routes/chat";
import type { NewsClient } from "./services/news";
import type { LlmClient } from "./services/llm";
```

And inside `createApp`, after `app.use(newsRouter(deps.news));`, add:

```ts
  app.use(chatRouter(deps.llm, deps.maxTokens));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/chat.route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/chat.ts src/server.ts tests/chat.route.test.ts
git commit -m "feat: POST /chat route"
```

---

## Task 6: Rate limiting

**Files:**
- Test: `tests/ratelimit.test.ts`

The rate-limit handler is injected into `createApp` (already supported via `deps.rateLimit`). This task verifies the app honors it; the real limiter is wired in `index.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubNews: NewsClient = { fetchHeadlines: async () => [] };
const stubLlm: LlmClient = { chat: async () => "ok" };

describe("rate limiting", () => {
  it("returns 429 after the limit is exceeded", async () => {
    const app = createApp({
      llm: stubLlm,
      news: stubNews,
      maxTokens: 256,
      rateLimit: rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true }),
    });

    await request(app).get("/health").expect(200);
    await request(app).get("/health").expect(200);
    const third = await request(app).get("/health");

    expect(third.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/ratelimit.test.ts`
Expected: PASS — `createApp` already mounts `deps.rateLimit` before routes, so no code change is needed. If it FAILS, ensure `if (deps.rateLimit) app.use(deps.rateLimit);` sits before the route mounts in `src/server.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/ratelimit.test.ts
git commit -m "test: verify injected rate limiter returns 429"
```

---

## Task 7: Entry point + real wiring

**Files:**
- Create: `src/index.ts`
- Test: `tests/health.test.ts`

- [ ] **Step 1: Write a health smoke test (does not start a real server)**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

describe("GET /health", () => {
  it("reports ok", async () => {
    const app = createApp({
      llm: { chat: async () => "ok" } as LlmClient,
      news: { fetchHeadlines: async () => [] } as NewsClient,
      maxTokens: 256,
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/health.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the entry point**

```ts
// src/index.ts
import rateLimit from "express-rate-limit";
import { loadConfig } from "./config";
import { createApp } from "./server";
import { createLlmClient } from "./services/llm";
import { createNewsClient } from "./services/news";

const cfg = loadConfig();

const app = createApp({
  llm: createLlmClient({ apiKey: cfg.anthropicApiKey, model: cfg.model }),
  news: createNewsClient({ apiKey: cfg.newsApiKey }),
  maxTokens: 1024,
  rateLimit: rateLimit({ windowMs: 60_000, max: cfg.rateLimitMax, standardHeaders: true }),
});

app.listen(cfg.port, () => {
  console.log(`bram proxy listening on :${cfg.port}`);
});
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: `tsc` completes with no errors; `dist/index.js` exists.

- [ ] **Step 5: Manual smoke test (optional, needs real keys)**

With a `.env` containing real keys loaded into the shell, run `npm run dev`, then in another shell:
`curl -s localhost:3000/health` → `{"ok":true}`.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/health.test.ts
git commit -m "feat: server entry point with real client wiring"
```

---

## Task 8: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Bram Proxy

Thin, stateless proxy for the Bram app. Holds the Claude + news API keys; stores nothing.

## Endpoints
- `POST /chat` — `{ system, messages }` → `{ reply }`
- `POST /news` — `{ topics }` → `{ headlines }`
- `GET /health` — `{ ok: true }`

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in keys.
3. `npm run dev` (watch) or `npm run build && npm start`.

## Test
`npm test`

## Design
Stateless by design — no database, no personal data. See
`docs/superpowers/specs/2026-06-05-bram-voice-assistant-design.md`.
```

- [ ] **Step 2: Run the full suite one last time**

Run: `npx vitest run`
Expected: all tests PASS (config, news service, news route, llm service, chat route, rate limit, health).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: backend proxy README"
```

---

## Self-Review

**Spec coverage (spec §4–§8):**
- §4 three-layer architecture, stateless proxy → Tasks 3, 7 (`createApp`, no DB).
- §5.2 `/chat`, `/news`, key holding, rate limiting, no DB → Tasks 3, 5, 6, 7.
- §5.3 Claude + news integrations → Tasks 2, 4.
- §8 secrets only on server (`.env`, never in binary), text-only egress, HTTPS at deploy, rate limiting → Tasks 0 (`.gitignore` excludes `.env`), 6, 7.
- §12 open questions (model id, news provider) → surfaced as a note in Task 4 and `.env`-configurable model/provider.

**Not in this plan (correctly out of scope):** mobile app, local SQLite, voice — those belong to Plan 2. At-rest encryption + sync are post-MVP (spec §11).

**Placeholder scan:** none — every code step has complete code and an exact command with expected output.

**Type consistency:** `LlmClient.chat(system, messages, maxTokens)`, `ChatMessage{role,content}`, `NewsClient.fetchHeadlines(topics)`, `Headline{title,source,url}`, and `AppDeps{llm,news,maxTokens,rateLimit?}` are used identically across Tasks 3–7.

**Deploy note (for execution):** terminate TLS at the host/CDN (spec §8 HTTPS); the Express app speaks plain HTTP behind it.
```
