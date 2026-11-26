#!/usr/bin/env node
// Screenshots the popup and desk from the built extension, for pull request screenshots.
//
//   npm run build
//   node scripts/pr-capture.mjs --surface popup,desk --view board --fixture scripts/fixtures/goals-and-queue.json
//
// Options:
//   --surface   popup, desk, or both separated by commas (default: popup)
//   --view      desk view: board, videos, review or history (default: board)
//   --schemes   light, dark or both (default: light,dark)
//   --widths    viewport widths in px (default: 360 for the popup, 1280,390 for the desk)
//   --fixture   JSON of storage values to seed before capturing; replaces the stored data
//   --out       output folder (default: a folder under the system temp directory)
//   --build     run `npm run build` first
//
// Needs Playwright and a Chromium build with the full browser (not the headless shell, which cannot load extensions).
// Finds `playwright` in PW_MODULE, the project's node_modules, or ~/.claude/scripts/node_modules. Finds Chromium in the
// Playwright cache, or at the executable named by PW_CHROMIUM.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(root, ".output", "chrome-mv3");
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--build") opts.build = true;
    else if (arg.startsWith("--")) opts[arg.slice(2)] = argv[++i];
  }
  return opts;
}

function list(value, fallback) {
  return (value ?? fallback).split(",").map((item) => item.trim()).filter(Boolean);
}

function loadPlaywright() {
  const candidates = [
    process.env.PW_MODULE,
    path.join(root, "node_modules", "playwright"),
    path.join(os.homedir(), ".claude", "scripts", "node_modules", "playwright"),
    "playwright",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error("Playwright not found. Install it, or set PW_MODULE to the folder that contains it.");
}

function findChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const cacheRoots = [
    path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
  ];
  for (const cache of cacheRoots) {
    if (!fs.existsSync(cache)) continue;
    const builds = fs.readdirSync(cache).filter((name) => name.startsWith("chromium-")).sort().reverse();
    for (const build of builds) {
      for (const sub of [path.join("chrome-win64", "chrome.exe"), path.join("chrome-win", "chrome.exe"), path.join("chrome-linux", "chrome"), path.join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium")]) {
        const exe = path.join(cache, build, sub);
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  return undefined;
}

const PAGES = {
  popup: { file: "popup.html", height: 640, widths: [360] },
  desk: { file: "desk.html", height: 860, widths: [1280, 390] },
};

const opts = parseArgs(process.argv.slice(2));
if (opts.build) execSync("npm run build", { cwd: root, stdio: "inherit" });
if (!fs.existsSync(path.join(extensionDir, "manifest.json"))) {
  throw new Error(`No built extension at ${extensionDir}. Run npm run build, or pass --build.`);
}

const surfaces = list(opts.surface, "popup");
const schemes = list(opts.schemes, "light,dark");
const view = opts.view ?? "board";
const out = path.resolve(opts.out ?? path.join(os.tmpdir(), "immersion-pr-shots"));
const fixture = opts.fixture ? JSON.parse(fs.readFileSync(path.resolve(opts.fixture), "utf8")) : null;
fs.mkdirSync(out, { recursive: true });

const { chromium } = loadPlaywright();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "immersion-pr-profile-"));
const context = await chromium.launchPersistentContext(profile, {
  headless: !opts.headed,
  executablePath: findChromium(),
  ignoreDefaultArgs: ["--disable-extensions"],
  args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`, "--no-first-run"],
});

const captured = [];
const errors = [];
try {
  let worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker", { timeout: 20000 }));
  const extensionId = new URL(worker.url()).host;

  if (fixture) {
    await worker.evaluate(async (data) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
    }, fixture);
  }

  for (const surface of surfaces) {
    const spec = PAGES[surface];
    if (!spec) throw new Error(`Unknown surface "${surface}". Use popup or desk.`);
    const widths = opts.widths ? list(opts.widths, "").map(Number) : spec.widths;
    for (const scheme of schemes) {
      for (const width of widths) {
        const page = await context.newPage();
        const label = surface === "desk" ? `desk-${view}` : surface;
        const name = `${label}-${scheme}-${width}.png`;
        page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(`${name}: ${message.text()}`);
        });
        page.on("response", (response) => {
          if (response.status() >= 400) errors.push(`${name}: ${response.status()} ${response.url()}`);
        });
        await page.addInitScript((theme) => {
          try {
            localStorage.setItem("theme", theme);
          } catch {}
        }, scheme);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: spec.height });
        const hash = surface === "desk" ? `#${view}` : "";
        await page.goto(`chrome-extension://${extensionId}/${spec.file}${hash}`, { waitUntil: "load" });
        await page.waitForSelector("#app > *", { timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const file = path.join(out, name);
        await page.screenshot({ path: file, fullPage: true });
        captured.push(file);
        await page.close();
      }
    }
  }
  console.log(JSON.stringify({ extensionId, captured, errors }, null, 2));
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
