# ASCN independent observatory

Follow current owner instructions and the shared memory protocol. Before UI
work, apply anti-slop-design and read DESIGN-ANTI-SLOP.md and DESIGN-MSH.md. Preserve the maps,
videos, research, charts and publicly sourced content. The owner requires that
only public material be public: private mail, internal drafts and redacted
snippets stay local. A public URL does not authenticate private-derived prose.

`npm run check` includes objective design and publication gates. Do not weaken
them to make a release pass. Record source review before changing the archive
fingerprint or asset manifest. New datasets and runtime modules need explicit
publication allowlisting. Never add raw research directories to the build.

For visual releases, capture all views at 1440/1024/390px, list hits against the
seven design rules, fix and re-capture, and obtain an independent reviewer as
required by the skill. Existing deliberate palette/type choices remain unless
the owner asks to change them. Commit, push, deploy and verify live bytes and
actual user flows before reporting success.

Publication guard: every build validates the completed artifact, and the standard
`npm run deploy` verifies exact live bytes and no-store denial of private paths.
Use these gates for every release; never treat provider success or a healthy
home page as proof of privacy. Historical Git cleanup still requires the owner's
separate approval; safety work does not authorize a rewrite or force-push.

MSH is a standing design law: geometry must serve reading and action. Run
`npm run audit:spatial` at the documented viewports, inspect the screenshots,
and record chrome cost, task visibility, hierarchy, preservation and remaining
findings. A numerical pass alone is not a visual pass. Keep screenshots local.

Composition is a release gate too. `npm run audit:composition` measures every
view for empty bands beside content — a column that ran out while its neighbour
ran on — and fails on an interior band, on a heavy rule that crosses one, and on
a hairline-framed band whose content stops short on one side and repeats down a
list. `tests/composition.spec.mjs` is its falsifier: plant the defect, prove the
gate goes red, restore. Do not widen the gate's thresholds to make a release
pass; repair the layout or record the reason in `AUDIT-2026-11-22.md`.

The reading-measure sweep in `npm run audit:graphics` is part of the same law:
every view at 1440, 1024 and 390, measured in real characters against a ceiling
of 75. Take its route list from the nav — a route name that is not real falls
back to the Overview and silently sweeps the wrong view.
