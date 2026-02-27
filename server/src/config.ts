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

export const config = {
  clientId: requireEnv("CLIENT_ID"),
  clientSecret: requireEnv("CLIENT_SECRET"),
  redirectUri: "http://127.0.0.1:3001/auth/callback",
  sessionSecret: process.env.SESSION_SECRET || "like2gig-dev-secret",
  port: parseInt(process.env.PORT || "3001", 10),
  clientOrigin: "http://127.0.0.1:5173",
};
