import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");

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

if (!fs.existsSync(standaloneDir)) {
  throw new Error("Standalone build not found. Run `next build` first.");
}

copyDir(staticDir, path.join(standaloneDir, ".next", "static"));
copyDir(publicDir, path.join(standaloneDir, "public"));

console.log("Standalone bundle prepared for Electron packaging.");
