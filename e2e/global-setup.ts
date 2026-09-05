import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup(): void {
  execFileSync("npm", ["run", "prisma:seed"], {
    cwd: path.resolve("server"),
    stdio: "inherit",
  });
}
