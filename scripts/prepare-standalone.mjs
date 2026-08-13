import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

/** Paths that must never ship inside the Electron standalone bundle. */
const STRIP_FROM_STANDALONE = [
  "dist",
  "data",
  ".git",
  ".workflow",
  ".cursor",
  "electron",
  "scripts",
  "src",
  "node_modules/.cache",
  "tsconfig.tsbuildinfo",
  "package-lock.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "eslint.config.mjs",
  "components.json",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing directory: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmPath(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error("Standalone build not found. Run `next build` first.");
}

for (const rel of STRIP_FROM_STANDALONE) {
  rmPath(path.join(standaloneDir, rel));
}

copyDir(staticDir, path.join(standaloneDir, ".next", "static"));
copyDir(publicDir, path.join(standaloneDir, "public"));

/**
 * Next.js file tracing often ships page runtimes but omits App Router route
 * runtimes (app-route-turbo.runtime.prod.js). Pages then return 200 while
 * /api/* returns 500. Copy all production next-server runtimes into every
 * traced next-server directory in the standalone bundle.
 */
function ensureNextServerRuntimes() {
  const srcDir = path.join(root, "node_modules", "next", "dist", "compiled", "next-server");
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Missing Next.js next-server runtimes at ${srcDir}`);
  }

  const prodRuntimes = fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".runtime.prod.js"));

  if (prodRuntimes.length === 0) {
    throw new Error(`No *.runtime.prod.js files found in ${srcDir}`);
  }

  const destDirs = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "next-server" && dir.endsWith(`${path.sep}compiled`)) {
          destDirs.push(full);
        } else if (entry.name !== ".cache") {
          walk(full);
        }
      }
    }
  }
  walk(path.join(standaloneDir, "node_modules"));

  if (destDirs.length === 0) {
    throw new Error("No compiled/next-server directories found in standalone bundle.");
  }

  for (const destDir of destDirs) {
    for (const name of prodRuntimes) {
      fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
    }
    console.log(`Ensured ${prodRuntimes.length} next-server runtimes in ${path.relative(standaloneDir, destDir)}`);
  }
}

ensureNextServerRuntimes();

console.log("Standalone bundle prepared for Electron packaging.");
