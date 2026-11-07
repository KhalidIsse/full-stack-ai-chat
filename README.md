# Full Stack AI Chat

A full-stack AI chat application where signed-in users can talk to an AI assistant, keep a searchable history of their conversations, and generate images from text descriptions.

Built with **Next.js 15**, **Better Auth**, **Drizzle ORM** on **Neon Postgres**, the **Vercel AI SDK**, and the **OpenAI API**.

## Features

- **Authentication** – email/password sign-up and sign-in, plus optional Google sign-in, powered by Better Auth. Sessions persist across page refreshes, and every API route checks the session.
- **Streaming AI chat** – replies from `gpt-4o` stream in token by token, rendered as Markdown, with a Stop button to cancel a response.
- **Chat history sidebar** – every conversation is saved to the database. Open an old chat to read it or continue it, start a new chat, or delete one. Chats are grouped by date (Today, Yesterday, Previous 7 days, …) and titled automatically from your first message. On phones the sidebar becomes a slide-out menu.
- **Image generation** – switch the input from **Chat** to **Image** mode, describe a picture, choose Square, Landscape or Portrait, and OpenAI's GPT Image model creates it. The image is saved in the conversation, reappears when you reopen the chat, and has a Download button.
- **Private by default** – conversations and images belong to the user who created them. Other users cannot open them, even with the URL.

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix UI), lucide-react, Streamdown (Markdown) |
| Authentication | Better Auth (email/password + Google OAuth) |
| Database | Neon serverless Postgres, Drizzle ORM |
| AI | Vercel AI SDK v5, OpenAI `gpt-4o` (chat), OpenAI GPT Image models (images) |

## Project structure

```
app/
  api/
    auth/[...all]/route.ts      Better Auth handler (sign-up, sign-in, sessions, OAuth)
    chat/route.ts               Streaming chat endpoint (gpt-4o) + saves messages
    conversations/route.ts      GET: list chats for the sidebar, POST: start a new chat
    conversations/[id]/route.ts DELETE: remove a chat
    images/route.ts             POST: generate an image and save it to the chat
    images/[id]/route.ts        GET: serve an image (owner only)
  chat/
    layout.tsx                  Chat layout with the history sidebar
    page.tsx                    Opens a fresh (or the existing empty) chat
    [id]/page.tsx               Loads and shows one conversation
  dashboard/  login/  signup/  test-auth/   Account pages
components/
  chat.tsx                      Chat window, Chat/Image mode, message rendering
  chat-sidebar.tsx              Conversation list, new chat, delete, account footer
  ui/                           shadcn/ui components
db/
  drizzle.ts                    Database connection (Neon HTTP driver)
  schema.ts                     Table definitions
lib/
  auth.ts / auth-client.ts      Better Auth server and browser clients
  chat-store.ts                 Conversation and message queries
  image-store.ts                Saving and loading generated images
  openai-image.ts               Calls OpenAI's image API
  image-message.ts              How image messages are stored/recognized
  conversation-title.ts         Auto-generated chat titles
migrations-manual/              SQL for tables added after the first release
scripts/add-image-table.mjs     Optional helper that runs the SQL above
docs/                           Extra documentation
```

## Getting started

### Prerequisites

- Node.js 20.6 or newer
- A free [Neon](https://neon.com) account and project
- An [OpenAI](https://platform.openai.com) API key with billing enabled
- (Optional) A Google Cloud OAuth client, if you want Google sign-in

### 1. Install

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in the values.

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon connection string. Click **Connect** in the Neon dashboard and copy it. It must be a Neon database because the app uses Neon's serverless driver. |
| `OPENAI_API_KEY` | Yes | Used for chat and image generation. |
| `BETTER_AUTH_SECRET` | Yes | A long random string. Generate one with `openssl rand -base64 32`. Use a different value in production. |
| `BETTER_AUTH_URL` | Yes | `http://localhost:3000` locally, your real URL in production. |
| `NEXT_PUBLIC_APP_URL` | Yes | Same URL as above. It is baked into the browser bundle at build time, so set it before building. |
| `OPENAI_IMAGE_MODEL` | No | Default `gpt-image-2.5-flare` (fast). Others: `gpt-image-2.5-sunburst` (highest quality), `gpt-image-2.6-flare`, `gpt-image-2.6-sunburst`. Set this **only once** in `.env`. |
| `OPENAI_IMAGE_QUALITY` | No | `low`, `medium` (default) or `high`. Higher quality costs more. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Only needed for the "Continue with Google" buttons. |

> **Image models:** OpenAI removed `dall-e-2` and `dall-e-3` from its API in May 2026, and older GPT Image models are being retired. This app uses the current GPT Image models. OpenAI may require you to **verify your organization** (platform.openai.com → Settings → Organization → General) before you can use them.

> **Keep secrets private:** `.env` is git-ignored. Never commit it or paste its contents anywhere public.

### 3. Set up the database

The app needs seven tables: `user`, `session`, `account`, `verification`, `conversation`, `message`, and `generated_image`.

**Authentication and chat tables.** On a new, empty database you can create them from the schema in `db/schema.ts`:

```bash
npx drizzle-kit push
```

**Image table.** Create the `generated_image` table with either option:

1. **Neon SQL Editor** – paste the contents of `migrations-manual/001_add_generated_image.sql` and run it, or
2. **Terminal** – `npm run db:add-images` (reads `DATABASE_URL` from `.env`).

> **Known issue:** `drizzle-kit push` fails on Postgres 18 (Neon's default) when the tables already exist, with the error `column "id" is in a primary key`. This is a drizzle-kit bug, not a problem with your database. If you change `db/schema.ts` later, apply the change with plain SQL in the Neon SQL Editor, or create the database on Postgres 17.

### 4. Run the app

```bash
npm run dev
```

Open http://localhost:3000, create an account on `/signup`, then go to `/chat`.

### Google sign-in (optional)

1. In Google Cloud Console go to **APIs & Services → Credentials** and create an **OAuth client ID** (type: Web application).
2. Add these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-DOMAIN/api/auth/callback/google`
3. Put the client ID and secret in `.env` and restart the server.

## How it works

**Chat.** The browser sends only the newest message to `/api/chat`. The server confirms the user owns the conversation, loads earlier messages from the database, streams the `gpt-4o` reply back, and saves both the user message and the assistant reply when streaming finishes. The first message also becomes the chat's title.

**Image generation.** In Image mode the browser sends the prompt to `/api/images`. The server calls OpenAI's image API directly and stores the result in the `generated_image` table as a compressed JPEG (base64 text). It then saves two normal messages: your prompt, and an assistant message containing a link of the form `![prompt](/api/images/<id>)`. The chat window recognizes that format and shows the picture instead of text. The image is served by `/api/images/[id]`, which only returns it to its owner. When the AI is asked a follow-up chat question, past images are replaced by a short text description so the language model never receives image links.

**Sidebar.** The conversation list is loaded on the server, then refreshed in the browser whenever you navigate, finish a reply, or create an image. Empty drafts are hidden, and "New chat" reuses your newest empty chat instead of creating a new one each time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint the code |
| `npm run db:add-images` | Create the `generated_image` table |

## Deploying (for example on Vercel)

1. Push the code to GitHub and import the repository in Vercel.
2. Add all environment variables from the table above in the project settings. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production URL (`https://…`, no trailing slash) **before** the first build.
3. Run the SQL in `migrations-manual/001_add_generated_image.sql` against the production database. If production uses the same Neon database you already set up, nothing more is needed.
4. If you use Google sign-in, add your production callback URL (see above) in Google Cloud Console.
5. Deploy. If you change `NEXT_PUBLIC_APP_URL` later, redeploy.

Chat replies can run up to 30 seconds and image generation up to 60 seconds. Check that your hosting plan allows function durations that long.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `relation "…" does not exist` | A table is missing. Re-check step 3, including the `generated_image` table. |
| Chat returns `Unauthorized` | You are not signed in. Sign in at `/login`. |
| Chat shows an error, terminal mentions `401` or "Incorrect API key" | `OPENAI_API_KEY` is wrong or missing. Fix `.env` and restart the server. |
| Terminal mentions `insufficient_quota` or `429` | Your OpenAI account needs billing credit. |
| Image error says the organization must be verified | Verify your organization in OpenAI settings (see above), then wait a few minutes. |
| Image error says the model does not exist | You are using a retired model. Remove `OPENAI_IMAGE_MODEL` or set it to `gpt-image-2.5-flare`. |
| Image rejected by "safety system" | OpenAI's content policy blocked the prompt. Reword it. |
| Changes to `.env` have no effect | Stop the dev server (Ctrl+C) and start it again. |

## Limitations and ideas for improvement

- Generated images are stored in the database. That is simple, but for heavy use you should move them to object storage such as Vercel Blob or Amazon S3.
- Every image is billed to your OpenAI account. Add per-user rate limits or quotas before opening the app to the public.
- Email verification and password reset are not set up yet.
- Chats can be deleted but not yet renamed.