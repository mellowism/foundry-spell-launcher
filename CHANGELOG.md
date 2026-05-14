# Changelog

All notable changes to Foundry Spell Launcher are documented here.

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
