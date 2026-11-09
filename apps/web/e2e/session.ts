import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUTH_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test-results/.auth-a.json");
