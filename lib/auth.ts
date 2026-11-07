import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/drizzle";
import { nextCookies } from "better-auth/next-js";
import { schema } from "../db/schema";

export const auth = betterAuth({
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
        maxPasswordLength: 128,
    },
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            accessType: "offline",
            prompt: "select_account consent",
        },
    },
    plugins: [
        nextCookies(),
    ],
});