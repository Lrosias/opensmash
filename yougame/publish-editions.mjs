// Publish OpenSmash64 and Smash Remix together, from one package directory, so a change to the
// shared game never reaches one edition without the other. The two editions are the same engine
// and the same wrapper (only the roster, media and app BUILD differ), so every file they share
// must be identical before anything is uploaded.
//
//   YOUGAME_API_KEY=$YOUGAME_API_KEY_OPENSMASH node yougame/publish-editions.mjs <package-dir> --notes "..." [--kind minor|major] [--dry-run]
//
// <package-dir> holds original/ and remix/ (see package-edition.mjs / package-touch-update.mjs).
// Steps: compare the shared files, upload original then remix (the site's upload-build.mjs
// helper), publish original, then publish remix with `upstream` = the original's upload id so
// the remix listing's base follows. Refuses to publish one edition alone.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const run = promisify(execFile);

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const dry = args.includes("--dry-run");
const kind = opt("--kind", "minor");
const notes = opt("--notes", "");
const site = process.env.YOUGAME_SITE || "https://yougame.co";
const key = process.env.YOUGAME_API_KEY;
if (!dir) throw new Error("Pass the package directory that holds original/ and remix/");
if (!notes) throw new Error("Pass --notes: what changed, in a sentence players can read");
if (!key && !dry) throw new Error("YOUGAME_API_KEY is not set (the opensmash creator key)");
const editions = { original: { slug: "opensmash64", dir: path.join(dir, "original") }, remix: { slug: "opensmash64-remix", dir: path.join(dir, "remix") } };
for (const e of Object.values(editions)) await stat(path.join(e.dir, "app.mjs")).catch(() => { throw new Error(`${e.dir} is not a packaged edition (no app.mjs)`); });

// Every file the editions share must match: these carry the netplay, the engine and the controls.
// (game-profile.mjs, the roster and the media are edition-specific by design and are not compared.)
const shared = ["engine/BattleShip.js", "engine/BattleShip.wasm", "engine/index.html", "checkpoints.mjs", "page-compare.mjs", "page-compare.wasm", "native-room-session.mjs", "rollback-session.mjs", "rollback-engine.mjs", "lockstep.mjs", "competitive-ui.mjs", "competitive-set.mjs", "input.mjs", "keyboard.mjs", "frame-clock.mjs", "audio-output.mjs", "audio-ring.mjs", "audio-worklet.mjs", "session.mjs", "match-clock.mjs", "native-results.mjs", "style.css"];
const digest = async (p) => createHash("sha256").update(await readFile(p)).digest("hex").slice(0, 16);
const diverged = [];
for (const f of shared) {
  const [a, b] = await Promise.all([digest(path.join(editions.original.dir, f)).catch(() => null), digest(path.join(editions.remix.dir, f)).catch(() => null)]);
  if (a !== b) diverged.push(`${f} (original ${a ?? "missing"}, remix ${b ?? "missing"})`);
}
// app.mjs differs only by BUILD and the remix's roster import; anything else is a divergence too.
const appOf = async (e) => (await readFile(path.join(e.dir, "app.mjs"), "utf8")).replace(/BUILD\s*=\s*'[a-f0-9]+'/, "BUILD").replace(/remix-roster/g, "roster");
if ((await appOf(editions.original)) !== (await appOf(editions.remix))) diverged.push("app.mjs (beyond BUILD and the roster import)");
if (diverged.length) { console.error("The editions have diverged; package both from the same source before publishing:\n  " + diverged.join("\n  ")); process.exit(2); }
console.log(`shared files identical across editions (${shared.length} checked)`);
if (dry) { console.log("dry run: nothing uploaded"); process.exit(0); }

// The site's upload helper (prints the upload id on stderr and the check report on stdout).
const tmp = await mkdtemp(path.join(tmpdir(), "yg-upload-"));
const helper = path.join(tmp, "upload-build.mjs");
await writeFile(helper, await (await fetch(`${site}/upload-build.mjs`, { headers: { "user-agent": "Mozilla/5.0 publish-editions" } })).text());
async function upload(e) {
  const { stdout } = await run("node", [helper, e.dir], { env: { ...process.env, YOUGAME_API_KEY: key }, maxBuffer: 1 << 24 });
  const report = JSON.parse(stdout);
  if (report.verdict !== "ready") throw new Error(`${e.slug}: upload verdict ${report.verdict}\n${report.report || ""}`);
  console.log(`${e.slug}: uploaded ${report.uploadId} (${report.files} files, ${(report.bytes / 1048576).toFixed(1)} MB)`);
  return report.uploadId;
}
async function publish(e, uploadId, extra = {}) {
  const res = await fetch(`${site}/api/agent/update`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "user-agent": "Mozilla/5.0 publish-editions" }, body: JSON.stringify({ slug: e.slug, uploadId, kind, notes, ...extra }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${e.slug}: publish failed ${res.status} ${JSON.stringify(body)}`);
  console.log(`${e.slug}: published version ${body.version} -> ${body.url}${body.warnings?.length ? "\n  warnings: " + body.warnings.join("; ") : ""}`);
  return body;
}
const originalId = await upload(editions.original);
const remixId = await upload(editions.remix);
await publish(editions.original, originalId);
await publish(editions.remix, remixId, { upstream: originalId });
console.log("both editions live; the remix's base now points at this original.");
