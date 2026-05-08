import dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Charge d’abord back/.env si présent, sinon la .env racine du repo
const backEnv = resolve(process.cwd(), ".env");
const rootEnv = resolve(process.cwd(), "..", ".env");
dotenv.config({ path: existsSync(backEnv) ? backEnv : rootEnv });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis (back/.env ou .env racine).");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

