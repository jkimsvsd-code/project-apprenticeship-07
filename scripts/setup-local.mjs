import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (!existsSync(".dev.vars")) {
  writeFileSync(
    ".dev.vars",
    `BETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nBETTER_AUTH_URL=http://127.0.0.1:5173\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created ignored .dev.vars with a fresh local authentication secret.",
  );
} else console.log("Kept existing local authentication configuration.");
