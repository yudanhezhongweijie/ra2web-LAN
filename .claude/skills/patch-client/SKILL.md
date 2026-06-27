---
name: patch-client
description: >-
  Build the served webra2 client bundle (werhd.min.js) for a variant. Use when
  the user wants to switch the client to Yuri's Revenge or back to RA2, apply/refresh
  the YR engine + asset-checksum + expandmd patches, rebuild the client after an
  upstream update, or fix a "patch no longer applies / anchor drifted" abort.
---

# Patch the webra2 client bundle

The served `werhd.min.js` is **built, not hand-edited**: a pristine `.stock` copy is
transformed by tracked, self-validating patches in `tools/patch-client.mjs`. RA2 vs
Yuri's Revenge is a `--variant` flag, not two divergent binaries. Full design +
reliability notes: `tools/PATCHING.md`. Run the pipeline for the user — they should not
run the CLI themselves.

## Variants
- `ra2` — stock, no patches (output `== .stock`).
- `yuri` — engine `RedAlert2→YurisRevenge`, asset-checksum bypass, drop `expandmd01`
  from the YR required-files push. (The Eva-voice patch is intentionally disabled —
  it broke game start; do not re-enable without a browser-validated transform.)

## Steps
1. **Pick the variant.** If the user didn't say, ask `ra2` or `yuri`.
2. **Find the active bundle.** Default to the most recently modified release bundle:
   `ls -t assets/releases/*/werhd.min.js | head -1`. If several look plausible or it's
   ambiguous which is served, confirm with the user.
3. **Run it:**
   ```bash
   node tools/patch-client.mjs --variant=<ra2|yuri> --bundle <path>
   ```
   First run snapshots the current bundle to `<bundle>.stock` (assumes it's pristine
   upstream — sanity-check that it is before trusting it).
4. **Report** which patches applied (the script prints them).

## If it ABORTS ("patch X matched N×, expected …")
Upstream drifted. Do NOT force it. Re-anchor only the named patch:
1. Read the patch's `find` regex in `tools/patch-client.mjs`.
2. Locate the new form of that code in the bundle (grep stable tokens — method/property
   names, enum members, string literals — these survive minification; aliases like
   `Y3t`/`r`/`a` do not).
3. Update the patch to anchor on the stable tokens and wildcard the changed alias; keep
   `expect` accurate (it guards uniqueness + drift).
4. Re-run. Update `tools/PATCHING.md` if behavior changed.

## After building
- Remind the user to **hard-refresh** and **smoke-test in the browser** — especially
  after any major upstream change (a patch can match the right count but the wrong spot
  if upstream moved identical-looking code).
- Reliability is **good, not 100%**: survives re-minification and usually patch bumps;
  real upstream refactors break the affected patch (the abort catches that). Never
  silently ship a build whose patch count looks off.

## Taking an upstream update
`cp <new-upstream-bundle> <bundle>.stock`, then re-run the variant. Fix any aborted
patch per above. Always browser-test the result.
