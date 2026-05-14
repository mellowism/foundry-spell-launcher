import { MODULE_ID, setSpellMapping, getSpellLibrary } from './settings.js';

/**
 * Auto-detect Kind from dnd5e spell metadata. Best-effort heuristic.
 *
 * Mapping logic:
 *   cone target              → 'cone'
 *   line target              → 'range'
 *   self target              → 'marker' (drop anim at clicked spot, GM picks caster)
 *   area-ish (sphere/cube/cylinder/radius/square) → 'marker'
 *   creature target, touch   → 'range' (short distance, our range works fine)
 *   creature target, ranged  → 'range'
 *   anything else            → 'range' (safe default)
 */
export function inferKindFromSpell(item) {
  const target = item?.system?.target;
  const range = item?.system?.range;
  const targetType = String(target?.type ?? '').toLowerCase();

  if (targetType === 'cone') return 'cone';
  if (['sphere', 'cube', 'cylinder', 'radius', 'square'].includes(targetType)) return 'marker';
  if (targetType === 'self') return 'marker';
  if (targetType === 'line') return 'range';
  if (targetType === 'creature' || targetType === 'enemy' || targetType === 'ally') {
    const units = String(range?.units ?? '').toLowerCase();
    if (units === 'touch') return 'range';
    return 'range';
  }
  return 'range';
}

/**
 * Normalize spell name to JB2A snake_case path component.
 * "Fire Bolt" → "fire_bolt"
 * "Hunter's Mark" → "hunters_mark"
 * "Magic Missile" → "magic_missile"
 */
function toSnake(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Find a JB2A asset path matching this spell name.
 * Strategy:
 *   1. Exact-prefix match: jb2a.{snake_case}.* — pick shortest matching path
 *      (shortest tends to be the simplest/default variant)
 *   2. If no exact match: contains-anywhere match against the snake_case
 *   3. Return null if nothing found
 *
 * Returns the chosen path string, or null.
 */
export function findJB2APath(spellName) {
  if (!spellName) return null;
  const snake = toSnake(spellName);
  if (!snake) return null;

  const all = Sequencer?.Database?.publicFlattenedEntries;
  if (!Array.isArray(all) || !all.length) {
    console.warn(`[${MODULE_ID}] findJB2APath: Sequencer.Database.publicFlattenedEntries unavailable`);
    return null;
  }

  const prefix = `jb2a.${snake}.`;
  const exactMatches = all.filter(p => p.toLowerCase().startsWith(prefix));
  if (exactMatches.length) {
    // Prefer the shortest path — usually the default/simplest variant alias
    return exactMatches.sort((a, b) => a.length - b.length)[0];
  }

  // Fallback: contains the snake form anywhere after jb2a.
  const containsKey = `jb2a.${snake}`;
  const containsMatches = all.filter(p => p.toLowerCase().includes(containsKey));
  if (containsMatches.length) {
    return containsMatches.sort((a, b) => a.length - b.length)[0];
  }

  return null;
}

/**
 * Find a spell item on an actor by name (case-sensitive).
 */
export function findSpellItem(actor, spellName) {
  const items = actor?.items?.contents ?? actor?.items ?? [];
  return items.find(i => i?.type === 'spell' && i?.name === spellName) ?? null;
}

/**
 * Run auto-map for ALL unmapped spells on the actor. Returns a summary.
 */
export async function autoMapActorSpells(actor) {
  const library = getSpellLibrary();
  const items = actor?.items?.contents ?? actor?.items ?? [];
  const spells = items.filter(i => i?.type === 'spell');

  const seen = new Set();
  const results = { mapped: [], skipped: [] };

  for (const item of spells) {
    if (!item?.name || seen.has(item.name)) continue;
    seen.add(item.name);
    if (library[item.name]) continue; // already mapped, skip

    const kind = inferKindFromSpell(item);
    const file = findJB2APath(item.name);
    if (!file) {
      results.skipped.push(item.name);
      continue;
    }
    await setSpellMapping(item.name, { kind, file });
    results.mapped.push({ name: item.name, kind, file });
  }

  return results;
}
