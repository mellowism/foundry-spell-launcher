# Changelog

All notable changes to Foundry Spell Launcher are documented here.

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
