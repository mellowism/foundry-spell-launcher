export const MODULE_ID = 'foundry-spell-launcher';

export const SETTINGS = {
  SPELL_LIBRARY: 'spellLibrary'
};

/**
 * Library is a lookup table from spell-name → animation config.
 * Keys are exact spell names as they appear on actor sheets (case-sensitive).
 * Per-actor palette pulls actor.items filtered for type=spell, then matches
 * names against this table — only matched spells appear in the palette.
 */
export const DEFAULT_LIBRARY = {
  'Fire Bolt':       { kind: 'range',    file: 'jb2a.fire_bolt.orange' },
  'Eldritch Blast':  { kind: 'range',    file: 'jb2a.eldritch_blast.purple' },
  'Burning Hands':   { kind: 'cone',     file: 'jb2a.burning_hands.orange' },
  "Hunter's Mark":   { kind: 'marker',   file: 'jb2a.markers.runes.purple.outward' },
  'Misty Step':      { kind: 'teleport', file: 'jb2a.misty_step.01.purple' }
};

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.SPELL_LIBRARY, {
    name: game.i18n.localize('SPELL_LAUNCHER.Settings.SpellLibrary.Name'),
    hint: game.i18n.localize('SPELL_LAUNCHER.Settings.SpellLibrary.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: JSON.stringify(DEFAULT_LIBRARY, null, 2),
    requiresReload: false
  });
}

/**
 * @returns {Record<string, { kind: string, file: string, icon?: string }>}
 */
export function getSpellLibrary() {
  let raw;
  try {
    raw = game.settings.get(MODULE_ID, SETTINGS.SPELL_LIBRARY);
  } catch (_) {
    return DEFAULT_LIBRARY;
  }
  if (!raw || typeof raw !== 'string') return DEFAULT_LIBRARY;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_LIBRARY;
    // Filter to entries with required shape
    const cleaned = {};
    for (const [name, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.kind !== 'string' || typeof entry.file !== 'string') continue;
      cleaned[name] = entry;
    }
    return Object.keys(cleaned).length ? cleaned : DEFAULT_LIBRARY;
  } catch (e) {
    console.warn(`[${MODULE_ID}] Spell Library JSON parse error — using defaults`, e);
    ui.notifications?.warn(game.i18n.localize('SPELL_LAUNCHER.Notifications.InvalidLibrary'));
    return DEFAULT_LIBRARY;
  }
}
