-- Adds the table used to store AI-generated images.
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS "generated_image" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "conversation_id" text NOT NULL REFERENCES "conversation"("id") ON DELETE CASCADE,
  "prompt" text NOT NULL,
  "mime_type" text NOT NULL,
  "data" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
