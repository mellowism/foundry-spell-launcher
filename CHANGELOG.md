# Changelog

All notable changes to Foundry Spell Launcher are documented here.

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
