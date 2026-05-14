export const MODULE_ID = 'foundry-spell-launcher';

export const SETTINGS = {
  SPELL_LIBRARY: 'spellLibrary'
};

/**
 * Library is a lookup table: spell-name → animation config.
 * Keys are exact spell names as they appear on actor sheets (case-sensitive).
 * Minimal default — only paths verified working in JB2A free. Users add more
 * via the inline configure dialog (click an unmapped spell in the palette).
 */
export const DEFAULT_LIBRARY = {
  'Fire Bolt':       { kind: 'range', file: 'jb2a.fire_bolt.orange' },
  'Eldritch Blast':  { kind: 'range', file: 'jb2a.eldritch_blast.purple' }
};

export const SPELL_KINDS = ['range', 'cone', 'marker', 'teleport', 'melee', 'self'];

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
 * @returns {Record<string, { kind: string, file: string }>}
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

/**
 * Save (add or overwrite) a single spell mapping. Used by the inline
 * configure dialog so users never touch JSON directly.
 */
export async function setSpellMapping(name, mapping) {
  const lib = getSpellLibrary();
  const next = { ...lib, [name]: mapping };
  await game.settings.set(MODULE_ID, SETTINGS.SPELL_LIBRARY, JSON.stringify(next, null, 2));
}

export async function removeSpellMapping(name) {
  const lib = { ...getSpellLibrary() };
  delete lib[name];
  await game.settings.set(MODULE_ID, SETTINGS.SPELL_LIBRARY, JSON.stringify(lib, null, 2));
}
