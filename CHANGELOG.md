# Changelog

All notable changes to Foundry Spell Launcher are documented here.

## [0.4.1] — 2026-05-14

### Fixed — Asset selection now blocks directional variants for static kinds

Root cause for "Hunter's Mark / Bless / Spiritual Weapon render between caster and target": auto-map's keyword preference matched the **directional** JB2A variant (intro/projectile/cast phases) rather than the **static** variant (loop/target phases).

JB2A typically ships multiple phases per spell, e.g.:
- `jb2a.bless.400px.intro.bluegold` (directional intro)
- `jb2a.bless.400px.loop.bluegold` (static overlay) ← what we want
- `jb2a.bless.400px.outro.bluegold` (fadeout)

**Added `KIND_BLOCK` per kind:** marker / melee / self / cone / range / teleport each have a list of substrings that should NOT appear in chosen paths. Block filtering runs before keyword preference. Falls back to unblocked pool if all candidates are blocked.

**Improved `KIND_KEYWORDS`:** more precise patterns — markers prefer `.loop.`, melee prefers `.target.` and `400px`, etc.

### Added — Name-based kind overrides

Some spells have visual conventions that don't follow dnd5e metadata cleanly. Hard-coded overrides in `NAME_KIND_OVERRIDES`:

| Spell name | Forced kind |
|---|---|
| Misty Step, Dimension Door, Thunder Step, Word of Recall, Blink | teleport |
| Moonbeam, Spike Growth, Darkness, Fog Cloud, Wall of Fire, Entangle, Hunger of Hadar | marker |
| Spirit Guardians | self |
| Spiritual Weapon | marker |

Misty Step previously auto-detected as `self` (because dnd5e marks it as self-target). Now correctly snaps to `teleport`.

### Added — findJB2APath logs chosen path

`[foundry-spell-launcher] findJB2APath { spell, kind, chosen, candidatesCount, poolCount }` logs to console on every auto-map. Lets you diagnose mismatches without code spelunking — paste the log if a spell still picks the wrong asset.

## [0.4.0] — 2026-05-14

### Added — Two new kinds: `melee` and `self`

**`melee`** — touch / on-target spells. Animation plays attached to the clicked target token (so it follows if the token moves). Examples: Cure Wounds, Shocking Grasp, Inflict Wounds, weapon-as-spell touch attacks. If the click lands on empty canvas, falls back to that location.

**`self`** — buff spells that animate on the caster. **No crosshair shown** — the spell fires immediately on the controlled token. Examples: Bless, Mage Armor, Shield, Armor of Agathys.

`inferKindFromSpell` updated:
- `range.units === 'touch'` → `melee`
- `target.affects.type === 'self'` OR `range.units === 'self'` → `self`

`KIND_KEYWORDS` extended so auto-map prefers melee-flavored paths (`touch`, `strike`, `cure_wounds`, `healing.generic`) for melee kind, and self-flavored paths (`bless`, `mage_armor`, `shield_spell`) for self kind.

### Fixed — Marker now attaches to clicked tokens

Previously `marker` placed effects at the raw `x,y` of the crosshair click — even when the click landed on a token. Hunter's Mark on a moving enemy stayed at the original square instead of following.

**Fix:** when the crosshair hit a token, marker now uses `attachTo(token)` instead of `atLocation(x,y)`. The rune follows the token. Location-anchored placements (Moonbeam, Entangle on empty squares) still use `atLocation`.

### Fixed — Teleport actually moves the caster

Previously `teleport` played two poofs (at source + destination) but did not move the caster token. Now after the animation starts, the caster token's position is updated to the click point (grid-snapped).

### Fixed — Range now strictly between source and target token

When the crosshair hit a token, `range` (stretch) now uses the token as the destination explicitly. This corrects edge cases where the click coordinates were inside the token but the stretch terminated short.

### Reference — kind selection logic

| Kind | Target | Animation behaviour | dnd5e auto-detect signal |
|------|--------|---------------------|--------------------------|
| range | projectile to a point/token | stretches caster→click | creature target, ranged |
| cone | directional fan | stretches caster→click | template.type = cone |
| melee | on target | attached to clicked token | range.units = touch |
| self | on caster | no crosshair, plays on caster | target = self |
| marker | persistent on target/location | attached to token if hit, else at point | sphere/cube/radius template |
| teleport | move caster | poof+poof + actual token move | (configured manually) |

## [0.3.4] — 2026-05-14

### Changed — Cone uses stretchTo (AA-like directional cone)

The `cone` kind handler previously used `atLocation(source) + rotateTowards(click) + scaleToObject(3)` — a fixed-scale rotation. For JB2A assets where the natural shape isn't strongly directional, this rendered as a square/target rather than a cone.

**New behaviour:** `cone` uses `atLocation(source).stretchTo(crosshairResult)`. The asset stretches from the caster to the click point, giving:
- Directional shape (forces alignment along the caster→click axis)
- Length scales with click distance (click far = long cone, click near = short)
- Same Sequencer call as `range` — the difference between kinds is now the JB2A asset choice, not the call

This matches the Automated Animations template-flow feel without requiring a Foundry MeasuredTemplate preview step. Click distance becomes the visual length control.

Future v0.4 may add a true template-preview cone flow if Carl wants the rotating-preview-then-confirm UX from AA.

## [0.3.3] — 2026-05-14

### Fixed — inferKindFromSpell reads dnd5e 5.x schema

dnd5e 5.x relocated the spell AoE-shape from `system.target.type` to `system.target.template.type`. The "affects" sub-object holds creature/enemy/ally targeting. v0.3.2 still read the legacy path, so Burning Hands (and other AoE spells) auto-detected as `range` instead of `cone`.

**Fix:** read both `system.target.template.type` (new) and `system.target.type` (legacy), preferring template. Same for `affects.type`. Added `circle`, `object`, `space`, `wall` to the recognized type set.

Added a `[foundry-spell-launcher] inferKind` console log per call so future schema shifts are visible without code spelunking.

### Added — Save-mapping diagnostic log

Saving a mapping now logs `[foundry-spell-launcher] saving mapping { spell, kind, file }` so users can verify the dropdown value is actually being captured (a v0.3.2 user reported the dropdown change wasn't sticking — log will confirm whether it's a read issue or a render issue).

Save notification also now includes the kind: `Saved Burning Hands as kind=cone`.

## [0.3.2] — 2026-05-14

### Removed — "Auto-map" header button

Auto-map runs silently on every palette open (v0.3.1). The explicit button is redundant. Header now only shows stats + an "Effects" button. Stats hint now nudges the user toward right-click to configure when there are unmapped spells.

### Changed — Per-effect removal via Manage dialog

The previous "Clear effects" button cleared ALL persistent spell effects at once. v0.3.2 replaces it with an "Effects" button that opens a manage dialog listing each active persistent effect with its own `×` remove button. A "Clear all (N)" button at the bottom is still available for bulk action.

The dialog parses each effect's Sequencer name (`foundry-spell-launcher::SpellName::locationId`) so you see which spell + where without having to identify by canvas position.

### Improved — Kind-aware JB2A path selection (cone fix)

Auto-map's `findJB2APath` now takes a `kindHint` argument. Each kind has a set of keywords that JB2A path components tend to contain (cone: `cone`, `fire_cone`; range: `projectile`, `ray`, `bolt`; marker: `rune`, `circle`, `persistent`, `loop`; teleport: `portal`, `poof`). When multiple paths match a spell name, the auto-mapper prefers the one whose path contains a kind-appropriate keyword.

**Fix:** Burning Hands (kind: cone) should now select a path containing `cone` rather than a generic target-style asset. Same logic applies to other spells where JB2A offers multiple shapes.

If you have a wrong auto-map from a previous version: right-click the spell → Auto-detect → it'll pick the kind-appropriate variant.

## [0.3.1] — 2026-05-14

### Added — Auto-map on palette open (no button needed)

Auto-map now runs silently every time the palette opens. Library mappings are added in the background for any of the actor's spells that don't yet have one. Idempotent — existing mappings are never touched. The "Auto-map" button stays as an explicit re-run option.

**Risk discussion:** If a user explicitly removes a mapping via the configure dialog, re-opening the palette will re-add it. This is an edge case — for now we accept it. v0.4+ may track a "deliberately unmapped" set if it becomes annoying.

### Added — Right-click any spell to edit mapping

Right-click on a spell icon (mapped or unmapped) → opens the configure dialog directly. Left-click on mapped still casts. Lets you fix wrong auto-mappings without a roundabout flow.

### Added — Clear effects button

Palette header now has a "Clear effects" (broom icon, red-ish) button that ends ALL persistent Sequencer effects spawned by this module on the current scene. Useful for stuck Moonbeams, Hunter's Mark runes, Entangle vines, etc. that you can't easily click-to-remove.

The clear targets only effects whose Sequencer name starts with `foundry-spell-launcher::` — does not touch effects from other modules (Sequencer, JB2A, Automated Animations, ...).

## [0.3.0] — 2026-05-14

### Added — Auto-map (Sequencer DB + dnd5e metadata)

Major UX win. Two new auto-detection paths so you (almost) never need to manually configure spells.

**Palette header — "Auto-map all" button** appears whenever any spell on the actor is unmapped. Click it and the module:
1. Reads each unmapped spell's dnd5e metadata (target type, range, units)
2. Picks a Kind (range / cone / marker / teleport) from the metadata
3. Searches `Sequencer.Database.publicFlattenedEntries` for a JB2A path matching the spell name (`jb2a.{snake_case_name}.*`, shortest match wins)
4. Saves the mapping if a path is found; skips spells with no JB2A asset
5. Re-renders the palette so every successfully-matched spell is now clickable

Notification reports counts: `Auto-mapped N spell(s). M skipped (no JB2A asset found)`. Console log lists the skipped names so you know what to manually configure.

**Configure dialog — "Auto-detect from spell metadata + JB2A" button** appears when the dialog is opened with an actor context. One click pre-fills both Kind and Asset path. You can then edit either before saving.

### Added — `auto-map.js` module

New file exporting `inferKindFromSpell(item)`, `findJB2APath(name)`, `findSpellItem(actor, name)`, and `autoMapActorSpells(actor)`. Public API so other modules / macros can reuse the same logic.

### Changed — Configure dialog accepts `actor` option

Passed end-to-end from the palette button click so the dialog can run auto-detect for the right actor's spell list.

### Notes

The auto-mapper uses the `publicFlattenedEntries` getter on `Sequencer.Database`, which exists in current Sequencer versions. If your Sequencer is older and the getter is missing, auto-map gracefully reports zero matches and you can still configure manually.

## [0.2.2] — 2026-05-14

### Fixed — CSS cache hell (versioned stylesheet filename)

v0.2.0 + v0.2.1 shipped new CSS but the file path stayed `src/styles/spell-launcher.css` between releases. Browser/HTTP/Electron caches happily served the old CSS, so the new `.unmapped`-styling and forced grid-width never reached the client even after Foundry reload. JS works (versioned bundle filename) but CSS didn't get the same treatment.

**Fix:** `sync-manifest.mjs` now copies `src/styles/spell-launcher.css` to `dist/spell-launcher-v{version}.css` on every build and updates `module.json` `styles` accordingly. Same pattern as the JS bundle — unique URL per release, no cache layer can serve stale.

This is the second time the same lesson has bitten us; the `foundry-table-mode` learnings document this for JS only — the same versioning needs to apply to CSS when stylesheet content changes meaningfully between releases.

## [0.2.1] — 2026-05-14

### Fixed — Visual gaps in v0.2.0 palette

Three CSS/layout issues from v0.2.0 prod test:

- **Vertical-list layout (1 column):** window `position.width: 'auto'` collapsed below 8-column grid threshold. Forced `width: 380` to guarantee 8×36px columns + gaps fit. Grid CSS rules tagged `!important` to defeat any Foundry-side overrides.
- **Unmapped spells not visibly grayed:** stronger styling — `opacity: 0.55 !important` on the button itself, `grayscale(1)` on the image, dashed border in `#555`, and a bright orange `+` badge in the corner. Hover lights it up to almost-full color. Unmistakable.
- **Mapped spells now have a soft green border** (`#4a5`) so the visual distinction between mapped/unmapped is obvious even before hover.

### Added — Diagnostic log on palette render

`[foundry-spell-launcher] palette render` logs library keys, actor, total spell count, and mapped count on every open. If mapped count is 0 when it shouldn't be, the cause is now visible without code inspection.

## [0.2.0] — 2026-05-14

### Added — Show all spells + inline configure dialog (zero-JSON)

The palette now shows **all** of the selected actor's spells, not only those mapped in the library. Spells without a library mapping render **grayed out** with a small `+` overlay indicating they can be configured.

**Click an unmapped spell** → an inline configure dialog opens:
- Spell name (read-only, prefilled)
- Kind dropdown: range / cone / marker / teleport (with one-line semantics per kind)
- Asset path text input with **"Open Sequencer DB Viewer"** button — opens Sequencer's built-in asset browser
- Save / Cancel / Remove

After save, the palette re-renders and the spell is now clickable. No JSON editing required.

### Added — Pact-aware spell grouping (Warlocks)

Warlock pact spells are now grouped under "**Pact Magic — Nth Level**" using the actor's pact slot level (matches the dnd5e character sheet display), instead of base spell level. Non-warlock spells still group by `system.level`.

### Changed — dnd5e 5.1+ API

Migrated `system.preparation.mode` → `system.method` and `system.preparation.prepared` → `system.prepared` via a small `dnd5e-compat.js` shim. Removes the deprecation warning that fired on every palette open.

### Changed — Default library trimmed

Default library now ships with only **Fire Bolt** and **Eldritch Blast** — the two paths I have verified work in JB2A Free. The previous defaults (Burning Hands / Hunter's Mark / Misty Step) shipped with wrong paths that 404'd; pulled until verified. Add more spells via the configure dialog.

### Added — Settings helpers

`setSpellMapping(name, mapping)` and `removeSpellMapping(name)` exported from settings module — used by the configure dialog to mutate the library without exposing JSON to users.

## [0.1.5] — 2026-05-14

### Fixed — Palette frame is back (frame: false was the silent-fail cause)

v0.1.4 reverted to `window.frame: false` for "borderless popup" aesthetics. In V13 + dnd5e 5.x, ApplicationV2 with `frame: false` + `width: 'auto'` rendered to a detached or zero-size state — no visible palette. v0.1.3 had worked because `frame: true` gave the window a managed-size frame; reverting the frame ALSO reverted the rendering.

Lesson committed: in this ecosystem, frameless ApplicationV2 popups aren't viable without explicit pixel-sized position config. Title-bar frame is the working pattern.

**Title is now actor-aware:** `Spells — Balbor Darkmore` etc. Makes multi-window state clear.

### Removed
- Redundant in-palette `<div class="palette-actor">` actor-name header. The window title now carries that info, so the body is cleaner.

## [0.1.4] — 2026-05-14

### Changed — Per-actor spell list grouped by level

The palette now reads the **selected token's actor** and shows only spells **that exist on that actor's sheet** AND are mapped in the spell library. Spells are grouped by spell level (Cantrips, 1st Level, 2nd Level, ...). Spell icons in the palette come from the actor's spell items (`item.img`), so the visual matches the character sheet.

**Library data shape changed** from an array of `{name, icon, kind, file}` entries to a name-keyed lookup object `{ "Spell Name": { kind, file } }`. The library is now a lookup table consulted when building the per-actor palette — `icon` field removed because the actor's item image is used instead.

**Example library:**

```json
{
  "Fire Bolt":       { "kind": "range",    "file": "jb2a.fire_bolt.orange" },
  "Eldritch Blast":  { "kind": "range",    "file": "jb2a.eldritch_blast.purple" },
  "Burning Hands":   { "kind": "cone",     "file": "jb2a.burning_hands.orange" },
  "Hunter's Mark":   { "kind": "marker",   "file": "jb2a.markers.runes.purple.outward" },
  "Misty Step":      { "kind": "teleport", "file": "jb2a.misty_step.01.purple" }
}
```

**Behaviour:**
- Spell names must match actor sheet exactly (case-sensitive, including apostrophes).
- Actors with no mapped spells (Barbarian PCs, NPCs without spells, …) get an empty-state message.
- Token reference is passed end-to-end so `cast.js` uses the correct source token regardless of canvas selection state.

### Reverted — Diagnostic flags from v0.1.3

`frame: true`, forced position (300, 300), fixed width — all reverted. Palette is borderless again and positions next to the clicked Token HUD button, as designed in v0.1.1.

## [0.1.3] — 2026-05-14

### Diagnostic — Force-visible palette to isolate rendering bug

v0.1.2 confirmed the click handler fires and togglePalette runs, but the palette wasn't visible — instead the user saw a chat-sidebar toggle. v0.1.3 forces the palette into a worst-case visible state to isolate whether ApplicationV2 is rendering at all:

- **`frame: true`** with title "Spells" — gives the palette a window with title bar + close button. Cannot be hidden by CSS or layout.
- **Forced position (300, 300)** — center-of-screen, ignores caller-supplied position. Eliminates token-HUD overlap as a factor.
- **Forced width 360** — explicit size, no auto-shrink-to-content.
- **DOM-presence log** after render: logs whether `#spell-launcher-palette` exists in DOM, its rect, parent, and visibility.

Once we confirm rendering, v0.1.4 reverts these and resumes proper Token-HUD-positioned frameless layout.

## [0.1.2] — 2026-05-14

### Fixed — Token HUD button now visible + click handler diagnosed

- **Icon swap:** `fa-hat-wizard` is FontAwesome Pro and renders as an empty box on most Foundry installs. Replaced with `fa-magic` (FA Free, bundled with Foundry V13). The button is now visible.
- **stopImmediatePropagation** added to the click handler so the Token HUD's parent click handlers cannot intercept after our handler runs. Was reported in v0.1.1 prod-test that clicking the button "opened chat" — almost certainly a parent-element bubble issue.
- **Diagnostic logs** added: `[foundry-spell-launcher] token-HUD button clicked` on click, `[foundry-spell-launcher] togglePalette` on each open/close. Lets the next bug-hunt round confirm whether click fires before render.

## [0.1.1] — 2026-05-14

### Changed — Trigger moved from scene controls to Token HUD

v0.1.0 registered a scene-controls toolbar category "Spells". This worked but felt off-pattern — casting is a token-bound action. v0.1.1 replaces the scene-controls entry with a Token HUD button (right column), mirroring the "Assign Status Effects" flow: click the token, click the wizard-hat button, an icon-grid palette opens next to the HUD.

### Fixed — Three bugs from v0.1.0 prod-test

- **Palette crash on open:** `setPosition()` was called after `render(true)` before the element attached to DOM, throwing on `null.offsetWidth`. Position is now passed via render options.
- **`onClick`/`onChange` deprecation warning** in V13 scene-controls registration — removed along with the toolbar entry.
- **Three default-icon 404s** (Burning Hands, Hunter's Mark, Misty Step). The `icons/magic/*` paths I chose don't ship with all installs. Replaced with `icons/svg/*` fallbacks which are universal. Also added `onerror` fallback in the palette so user-configured paths gracefully degrade to a known icon if missing.

## [0.1.0] — 2026-05-14

### Added — Initial release

DM-side spell animation launcher. Icon-grid palette popup in the style of Foundry's status-effects overlay. Click spell icon → click target on canvas → Sequencer-driven animation plays. No per-item configuration, no spell-card mechanics, no slot consumption — pure visual.

**Designed for the DM-only Foundry workflow** where players track mechanics outside Foundry (D&D Beyond, paper sheets) and the table TV is a display surface.

**Built-in spell kinds:**
- `range` — projectile from caster to clicked point (Fire Bolt, Eldritch Blast)
- `cone` — cone from caster toward clicked direction (Burning Hands)
- `marker` — persistent rune on clicked location; click same spell again on same target to remove (Hunter's Mark)
- `teleport` — poof at caster + poof at destination (Misty Step)

**Default spell library (5):** Fire Bolt, Eldritch Blast, Burning Hands, Hunter's Mark, Misty Step.

**Config:** world-scoped `spellLibrary` setting (JSON array). Edit in Settings → Module Settings to add/remove/reorder spells.

**Toolbar:** new scene-controls category "Spells" with a single button that opens the palette.

**Dependencies:** Sequencer (required). JB2A (recommended — default spell paths reference JB2A free).
