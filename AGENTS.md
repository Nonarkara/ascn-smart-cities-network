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
back to the Overview and silently sweeps the wrong view. The sweep must also be
able to prove its own number: it reports the line it measured, and a control
fails the gate if the count and the text ever disagree.

A gate that only ever measures one mode is a gate that has only ever looked
at one mode. `npm run audit:composition` sweeps the views in English and dark
by default and takes `ASCN_COMPOSITION_LANG` (th, zh) and
`ASCN_COMPOSITION_THEME` (light) for the others; a release must sweep every
mode, because the modes are not the same geometry. Thai has no word spaces
and Chinese sets a character per em, so the same content breaks into
different lines: a defect that reads as a margin in English can be a hole in
Thai, and no English sweep will ever find it. Each mode keeps its own record
in `artifacts/composition/`.

Page cost is a release gate too. `npm run audit:cost` measures every view's
cost in SCREENS and compares it with the cap recorded for that view in
`scripts/cost-baseline.json`. A view that costs more than its cap fails; a
view that costs LESS than its cap also fails, because an improvement that was
not banked is a cap that has stopped being true. Raise a cap only with a
reason written in the baseline file, and only when the owner asks for it.
`tests/cost.spec.mjs` is its falsifier.

The live discovery endpoint is honest about what it can reach. Cloudflare's
edge is refused by the search index this site's lead list is drawn from, so
the published snapshot is the list of record and the live check is a bonus:
`/api/ascn-news` answers with the snapshot, marks itself `saved`, and gives
the reason each feed gave. Never let a 503 with no body stand in for the
list.
