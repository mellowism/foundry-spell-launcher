# Foundry Spell Launcher

DM-side spell animation launcher for Foundry VTT V13.

Icon-grid palette → click spell → click target on canvas → Sequencer-driven animation plays. **No per-item configuration. No spell-card mechanics. No slot consumption.** Pure visual.

Designed for the DM-only Foundry workflow where players track mechanics outside Foundry (D&D Beyond, paper sheets) and the table TV is a display surface.

## Install

Manifest URL: `https://raw.githubusercontent.com/mellowism/foundry-spell-launcher/main/module.json`

## Use

1. Enable the module
2. Click the new "Spells" category in the scene-controls toolbar (left side of canvas)
3. Select a caster token on canvas
4. The palette popup appears — click a spell icon
5. A crosshair appears — click where the spell should go
6. Animation plays. Done.

For `marker` spells (Hunter's Mark): click same spell on same target again to remove.

## Configure

Settings → Module Settings → Foundry Spell Launcher → `Spell Library`.

The library is a JSON array. Default ships with 5 spells. Add or edit entries:

```json
[
  {
    "name": "Fire Bolt",
    "icon": "icons/magic/fire/projectile-fireball-orange.webp",
    "kind": "range",
    "file": "jb2a.fire_bolt.orange"
  }
]
```

Fields:
- `name` — display name (tooltip)
- `icon` — Foundry icon path (any Foundry asset URL)
- `kind` — one of `range`, `cone`, `marker`, `teleport`
- `file` — Sequencer/JB2A asset path

To find correct JB2A paths: open browser console, run `Sequencer.DatabaseViewer.show()`.

## Dependencies

- **Sequencer** (required) — animation engine
- **JB2A** (recommended) — default assets reference JB2A Free; install JB2A Patreon for full spell coverage

## License

MIT. See LICENSE.
