# Client patch pipeline

The served client bundle (`werhd.min.js`) is **built, not hand-edited**. All
modifications (Yuri's Revenge engine, asset-checksum bypass, etc.) are declared as
tracked transforms in [`patch-client.mjs`](./patch-client.mjs) and applied to a
pristine upstream copy.

```
werhd.min.js.stock   ← pristine upstream (the only thing that changes on an update)
       │
       ▼   node tools/patch-client.mjs --variant=ra2|yuri --bundle <path>
werhd.min.js         ← served file; fully derived, never hand-edited, never .bak-swapped
```

This replaces ad-hoc `perl -pi -e` edits and `cp *.bak` swapping, which lost changes
across branches/updates and silently reintroduced old bugs.

## Usage

```bash
# RA2 (engine stock + house-rule lobby defaults — see below):
node tools/patch-client.mjs --variant=ra2  --bundle assets/releases/<ver>/werhd.min.js

# Yuri's Revenge — static swap (engine→YR + checksum bypass + drop expandmd01):
node tools/patch-client.mjs --variant=yuri --bundle assets/releases/<ver>/werhd.min.js

# DUAL ENGINE — one bundle runs BOTH (RA2 default, ?engine=yr / cdEngine=yr for Yuri):
node tools/patch-client.mjs --variant=dual --bundle assets/releases/<ver>/werhd.min.js
```

- First run snapshots the current bundle to `<bundle>.stock` (assumes it's pristine
  upstream — make sure it is). Every later run rebuilds **from `.stock`**, so it's
  idempotent: re-running can't double-apply, and switching variants is one command.
- RA2 / YR / dual is a **flag**, not divergent binaries.
- The built bundle is a **local artifact** — main commits the *stock* bundle, you build
  your variant locally. (`.stock` and `*.bak` are gitignored; don't commit the built one.)

## Enabling both engines (dual) on a host

main ships the **stock** bundle. To run both engines from one install:

```bash
# 1. build the dual bundle (RA2 default, Yuri via ?engine=yr or cdEngine=yr):
node tools/patch-client.mjs --variant=dual --bundle assets/releases/<ver>/werhd.min.js
# 2. point asset import at the combined archive (has RA2 base + YR md mixes):
#    config.ini → gameResArchiveUrl=__LANHTTP__/yr-assets.7z
# 3. put yr-assets.7z on disk in the client dir (gitignored; the LAN server serves it).
```

Validated headless: the dual bundle boots BOTH RA2 and YR (engine 4 md mixes load, 0 init
errors) and a two-client YR match starts and runs in sync. The dual variant does NOT
include the YR Eva-voice patch (alias-heavy, fragile) — YR plays fine without it; add it
separately if you want YR EVA voices. `yr-assets.7z` (324 MB) is **never committed** (over
GitHub's 100 MB limit) — it lives on disk and is served by the LAN server.

## House-rule lobby defaults (all variants)

Applied to every variant (incl. ra2), so the engine bundle is "stock + these defaults":

- **Every room starts clean** — the prefs read for the player's last country/color/start/
  team and the host's saved game options returns nothing, so the lobby falls back to its
  defaults (random slot, default options). In-room changes still work; they're just not
  restored next room. (One anchor on the prefs `getItem`.)
- **Superweapons off by default** in new games (`superWeapons:!0 → !1`, the 3 default sets).

Remove these by deleting `lobby-defaults-no-restore` / `superweapons-off-by-default` from
`PATCHES`. So `ra2` is no longer byte-identical to upstream stock — it carries these.

## Reliability: somewhat reliable, NOT 100%

Patches anchor on what minifiers **cannot** rename — property/method names, enum
members, string literals (`setActiveEngine`, `.EngineType.RedAlert2`,
`"expandmd01.mix"`) — and **wildcard** what they do rename (local vars / module
aliases like `Y3t`, `r`, `a`, which change every build — e.g. `Ad`→`kd` between
0.82.8 and 0.82.9).

**Survives:** pure re-minification (same source, new build), and usually patch-level
bumps (0.82.x).
**Does NOT survive:** real upstream refactors (a method renamed, logic restructured,
a feature rewritten). The affected patch will break — and should.

**Safety net:** every patch declares `expect` (how many times its anchor must match).
If it matches a different count, the script **aborts and names that patch** instead of
shipping a silently-wrong bundle. So you never re-map everything — you re-anchor only
the one patch it flags. `expect` also guards uniqueness (a too-loose anchor that hits
2 spots aborts).

**Residual risk:** a patch can match the right count but the *wrong* spot if upstream
moved identical-looking code. Anchors are chosen to be unique, but after any **major**
upstream change, verify the output (diff vs. the previous build, and smoke-test in the
browser). This pipeline does not recover original names (no source maps) and does not
find new bugs — it only re-applies known transforms.

## Taking an upstream update

1. Drop the new upstream bundle in as the new `werhd.min.js`, and refresh the snapshot:
   `cp <new-bundle> werhd.min.js.stock`
2. Re-run `patch-client.mjs --variant=<your variant>`.
3. If it **aborts**, the named patch's anchor drifted: open `patch-client.mjs`, find the
   new form of that code in the bundle, re-anchor (keep stable tokens, wildcard aliases),
   and re-run.
4. **Always** smoke-test the built bundle in the browser before relying on it.

## Adding / changing a patch

Add an entry to `PATCHES` in `patch-client.mjs`:

```js
{
  name: "short-id",
  variants: ["yuri"],            // which variant(s) it applies to
  find: /STABLE_anchor(\w+)volatile/g,   // anchor on stable tokens; wildcard aliases
  replace: "...$1...",
  expect: 1,                     // required match count (uniqueness + drift guard)
}
```

> The YR **Eva-voice loading** patch is intentionally left disabled in `patch-client.mjs`
> — the last hand-rolled version broke game start and no validated transform exists yet.
> Re-add it as a proper entry once it's confirmed working in the browser.
