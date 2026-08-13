import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const desktopDir = path.join(os.homedir(), "Desktop");
const applicationsDir = "/Applications";
const appName = "精细化AI规划.app";

function findAppBundle(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === appName) return full;
      const nested = findAppBundle(full);
      if (nested) return nested;
    }
  }
  return null;
}

function findDmg(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".dmg"));
  if (files.length === 0) return null;
  files.sort((a, b) => {
    const sa = fs.statSync(path.join(dir, a)).mtimeMs;
    const sb = fs.statSync(path.join(dir, b)).mtimeMs;
    return sb - sa;
  });
  return path.join(dir, files[0]);
}

const appSrc = findAppBundle(distDir);
const dmgSrc = findDmg(distDir);

if (!appSrc && !dmgSrc) {
  throw new Error("No .app or .dmg found in dist/. Run electron:build first.");
}

const results = [];

if (appSrc) {
  // Prefer updating the Launchpad / Finder app in /Applications
  if (fs.existsSync(applicationsDir)) {
    const appDest = path.join(applicationsDir, appName);
    fs.rmSync(appDest, { recursive: true, force: true });
    execFileSync("ditto", [appSrc, appDest], { stdio: "inherit" });
    results.push(appDest);
  }

  // Do not install/refresh Desktop — Launchpad uses /Applications.
  // Remove stale Desktop copy so it doesn't confuse users.
  const desktopApp = path.join(desktopDir, appName);
  if (fs.existsSync(desktopApp)) {
    fs.rmSync(desktopApp, { recursive: true, force: true });
    console.log(`Removed stale Desktop copy: ${desktopApp}`);
  }
}

if (dmgSrc && fs.existsSync(desktopDir)) {
  const dmgDest = path.join(desktopDir, path.basename(dmgSrc));
  fs.copyFileSync(dmgSrc, dmgDest);
  results.push(dmgDest);
}

console.log("Installed:");
for (const item of results) {
  console.log(`  - ${item}`);
}
