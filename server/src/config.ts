import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";

export const config = {
  cronSecret: process.env.CRON_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  clientId: requireEnv("CLIENT_ID"),
  clientSecret: requireEnv("CLIENT_SECRET"),
  redirectUri: `${baseUrl}/auth/callback`,
  sessionSecret: process.env.SESSION_SECRET || "like2gig-dev-secret",
  port: parseInt(process.env.PORT || "3001", 10),
  clientOrigin: baseUrl,
};
