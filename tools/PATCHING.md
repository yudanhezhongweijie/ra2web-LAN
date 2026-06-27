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
# RA2 (stock — no patches):
node tools/patch-client.mjs --variant=ra2  --bundle assets/releases/<ver>/werhd.min.js

# Yuri's Revenge (engine swap + checksum bypass + drop expandmd01):
node tools/patch-client.mjs --variant=yuri --bundle assets/releases/<ver>/werhd.min.js
```

- First run snapshots the current bundle to `<bundle>.stock` (assumes it's pristine
  upstream — make sure it is). Every later run rebuilds **from `.stock`**, so it's
  idempotent: re-running can't double-apply, and switching variants is one command.
- RA2 vs YR is a **flag**, not two divergent binaries.

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
