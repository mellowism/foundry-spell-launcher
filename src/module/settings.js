export const MODULE_ID = 'foundry-spell-launcher';

export const SETTINGS = {
  SPELL_LIBRARY: 'spellLibrary'
};

export const DEFAULT_LIBRARY = [
  {
    name: 'Fire Bolt',
    icon: 'icons/magic/fire/projectile-fireball-orange.webp',
    kind: 'range',
    file: 'jb2a.fire_bolt.orange'
  },
  {
    name: 'Eldritch Blast',
    icon: 'icons/magic/lightning/bolt-strike-blue.webp',
    kind: 'range',
    file: 'jb2a.eldritch_blast.purple'
  },
  {
    name: "Burning Hands",
    icon: 'icons/magic/fire/flame-burning-fingers-orange.webp',
    kind: 'cone',
    file: 'jb2a.burning_hands.orange'
  },
  {
    name: "Hunter's Mark",
    icon: 'icons/magic/control/silhouette-target-orange.webp',
    kind: 'marker',
    file: 'jb2a.markers.runes.purple.outward'
  },
  {
    name: 'Misty Step',
    icon: 'icons/magic/movement/abstract-portal-purple.webp',
    kind: 'teleport',
    file: 'jb2a.misty_step.01.purple'
  }
];

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
    if (!Array.isArray(parsed)) return DEFAULT_LIBRARY;
    return parsed.filter(s => s && typeof s.name === 'string' && typeof s.file === 'string' && typeof s.kind === 'string');
  } catch (e) {
    console.warn(`[${MODULE_ID}] Spell Library JSON parse error — using defaults`, e);
    ui.notifications?.warn(game.i18n.localize('SPELL_LAUNCHER.Notifications.InvalidLibrary'));
    return DEFAULT_LIBRARY;
  }
}
