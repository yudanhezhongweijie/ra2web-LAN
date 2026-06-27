#!/usr/bin/env node
// =============================================================================
// patch-client.mjs — build the served client bundle from a pristine upstream copy
// by applying a tracked, self-validating set of transforms.
//
//   <bundle>.stock   pristine upstream werhd.min.js (the ONLY thing that changes
//                    when you take an upstream update — never hand-edit it)
//         │
//         ▼   node tools/patch-client.mjs --variant=ra2|yuri --bundle <path>
//   <bundle>         served file — fully derived, never hand-edited, never .bak-swapped
//
// Why this exists: regex-patching a minified bundle by hand (or cp'ing .bak files)
// loses changes across branches/updates and silently reintroduces old bugs. This
// makes every client modification a tracked, idempotent, variant-aware transform.
//
// -----------------------------------------------------------------------------
// RELIABILITY: SOMEWHAT RELIABLE, NOT 100%.  ***READ THIS.***
// -----------------------------------------------------------------------------
// Patches anchor on tokens minifiers do NOT rename — property/method names, enum
// members, string literals (e.g. `setActiveEngine`, `.EngineType.RedAlert2`,
// `"expandmd01.mix"`) — and WILDCARD the parts they DO rename (local vars and
// module aliases like `Y3t`/`r`/`a`, which change every build, e.g. Ad→kd 0.82.8→0.82.9).
//
// What this buys you:
//   • Pure re-minification (same source, new build): patches survive.
//   • Patch-level bumps (0.82.x): usually survive.
// What it does NOT survive:
//   • Real upstream refactors (a method renamed, logic restructured, feature
//     rewritten). The affected patch WILL break — and SHOULD.
//
// The safety net: every patch declares `expect` (how many times its anchor must
// match). If a patch matches a different number of times, this script ABORTS and
// names the patch, instead of producing a silently-wrong bundle. So you never
// "re-map everything" — you re-anchor only the one patch the script flags.
// `expect` also guards uniqueness: a too-loose anchor that hits 2 places aborts.
//
// LIMITS / caveats:
//   • A patch can still match the RIGHT count but the WRONG spot if upstream moved
//     identical-looking code. Anchors are chosen to be unique, but verify after a
//     major upstream change (diff the output, or smoke-test in the browser).
//   • This does not recover original variable names (no source maps); it only
//     transforms known spots. New bugs still need investigation in the bundle.
//   • Always test the produced bundle in the browser after an upstream update.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

// ---- Patch definitions ------------------------------------------------------
// Each: { name, variants, find (global regex), replace, expect }
// `find` MUST be a global (/g) regex. `replace` may use $1.. capture refs.
const PATCHES = [
  {
    name: "engine-ra2-to-yr",
    variants: ["yuri"],
    // Anchor: setActiveEngine(<alias>.EngineType.RedAlert2). Wildcard the alias.
    find: /setActiveEngine\(([A-Za-z0-9_$]+)\.EngineType\.RedAlert2\)/g,
    replace: "setActiveEngine($1.EngineType.YurisRevenge)",
    expect: 1,
  },
  {
    name: "bypass-asset-checksum",
    variants: ["yuri", "dual"],
    // Anchor: !<v>.includes(<v>.toString(16).toUpperCase())  → always false.
    find: /!([A-Za-z0-9_$]+)\.includes\(([A-Za-z0-9_$]+)\.toString\(16\)\.toUpperCase\(\)\)/g,
    replace: "!1",
    expect: 1,
  },
  // --- dual-engine variant: one bundle runs BOTH engines ---------------------
  // RA2 by default; YR when localStorage.cdEngine==="yr" or ?engine=yr. One asset
  // import (yr-assets.7z) stores both sets. See tools/PATCHING.md.
  {
    name: "engine-dual-toggle",
    variants: ["dual"],
    // Same anchor as the static yuri swap, but make the engine a runtime choice.
    find: /setActiveEngine\(([A-Za-z0-9_$]+)\.EngineType\.RedAlert2\)/g,
    replace:
      'setActiveEngine((localStorage.getItem("cdEngine")==="yr"||new URLSearchParams(location.search).get("engine")==="yr")?$1.EngineType.YurisRevenge:$1.EngineType.RedAlert2)',
    expect: 1,
  },
  {
    name: "expandmd-always-import",
    variants: ["dual"],
    // The required-files push is guarded by `<alias>.EngineType.YurisRevenge&&`. Drop
    // the guard so the md mixes (present in yr-assets.7z) import for either engine.
    find: /[A-Za-z0-9_$]+\.EngineType\.YurisRevenge&&([A-Za-z0-9_$]+\.push\("ra2md\.mix","langmd\.mix","expandmd01\.mix","multimd\.mix"\))/g,
    replace: "$1",
    expect: 1,
  },
  {
    name: "drop-expandmd01-from-required",
    variants: ["yuri"],
    // Anchor: the YR required-files push list. Drop the (absent) expandmd01 entry.
    // Distinct from the two ".set(...)" CRC maps that also mention expandmd01.mix.
    find: /(\.push\("ra2md\.mix","langmd\.mix",)"expandmd01\.mix",/g,
    replace: "$1",
    expect: 1,
  },
  // --- EXPERIMENTAL / DISABLED -----------------------------------------------
  // The YR Eva-voice loading patch (engine===4 → load eva-ally/eva-sov via
  // appResourceLoader) is intentionally NOT enabled: the last hand-rolled version
  // broke game start, and no validated transform exists yet. Re-add here as a
  // proper {find,replace,expect} once it's confirmed working in the browser.
];

// ---- CLI --------------------------------------------------------------------
function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return def;
}

const variant = arg("variant", "ra2");
const bundle = arg("bundle", "assets/releases/0.82.9-r8acefdf-d49bbca7f/werhd.min.js");
const stock = `${bundle}.stock`;

if (!["ra2", "yuri", "dual"].includes(variant)) {
  console.error(`error: --variant must be ra2, yuri, or dual (got "${variant}")`);
  process.exit(2);
}
if (!existsSync(bundle)) {
  console.error(`error: bundle not found: ${bundle}`);
  process.exit(2);
}

// Establish the pristine source. If no .stock yet, treat the current bundle as
// pristine upstream and snapshot it (so subsequent builds are reproducible).
if (!existsSync(stock)) {
  copyFileSync(bundle, stock);
  console.log(`note: created pristine snapshot ${stock} from current bundle`);
  console.log(`      (assuming the current bundle is unpatched upstream — verify if unsure)`);
}

let src = readFileSync(stock, "utf8");
const applied = [];

for (const p of PATCHES) {
  if (!p.variants.includes(variant)) continue;
  const matches = src.match(p.find);
  const count = matches ? matches.length : 0;
  if (count !== p.expect) {
    console.error(
      `\nABORT: patch "${p.name}" matched ${count}× (expected ${p.expect}).\n` +
        `       Upstream likely changed this code. Re-anchor this patch before shipping.\n` +
        `       Anchor: ${p.find}`,
    );
    process.exit(1);
  }
  src = src.replace(p.find, p.replace);
  applied.push(p.name);
}

writeFileSync(bundle, src);
console.log(`\n✓ built ${bundle}`);
console.log(`  variant: ${variant}`);
console.log(`  patches applied: ${applied.length ? applied.join(", ") : "(none — stock)"}`);
