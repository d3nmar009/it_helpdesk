// Completes `.next/standalone` after `next build` so the folder can be copied to a server and run
// with `node server.js` (or pm2). Next.js leaves static assets and `public/` out of standalone.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No .next/standalone/server.js found. Run `next build` with output: \"standalone\" first.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

// Local dev attachments must not ship: they would overwrite or mix with the server's real uploads.
rmSync(path.join(standalone, "public", "uploads"), { recursive: true, force: true });
cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
  filter: (src) => !path.relative(path.join(root, "public"), src).split(path.sep).includes("uploads"),
});
mkdirSync(path.join(standalone, "public", "uploads"), { recursive: true });

// File tracing only keeps the bcrypt binary for the build machine; ship all so the server OS doesn't matter.
cpSync(
  path.join(root, "node_modules", "bcrypt", "prebuilds"),
  path.join(standalone, "node_modules", "bcrypt", "prebuilds"),
  { recursive: true },
);

cpSync(path.join(root, "scripts", "ecosystem.config.cjs"), path.join(standalone, "ecosystem.config.cjs"));
cpSync(path.join(root, "DEPLOY.md"), path.join(standalone, "DEPLOY.md"));

console.log(`Standalone package ready: ${standalone}`);
