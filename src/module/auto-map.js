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
  const system = item?.system ?? {};
  const range = system.range;

  // Schema shift in dnd5e 5.x: AoE shape moved from system.target.type to
  // system.target.template.type. Affects (creature/enemy/ally) lives on
  // system.target.affects.type. Read both, prefer template.
  const templateType = String(
    system.target?.template?.type
      ?? system.target?.type
      ?? ''
  ).toLowerCase();
  const affectsType = String(
    system.target?.affects?.type
      ?? ''
  ).toLowerCase();
  const targetType = templateType || affectsType;

  // Diagnostic log so future schema shifts are easier to track.
  console.log(`[${MODULE_ID}] inferKind`, {
    name: item?.name,
    templateType,
    affectsType,
    resolved: targetType
  });

  if (targetType === 'cone') return 'cone';
  if (['sphere', 'cube', 'cylinder', 'radius', 'square', 'circle'].includes(targetType)) return 'marker';
  if (targetType === 'self') return 'marker';
  if (targetType === 'line' || targetType === 'wall') return 'range';
  if (['creature', 'enemy', 'ally', 'object', 'space'].includes(targetType)) {
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
 * Keywords that hint at a given kind in JB2A asset paths.
 * Used to prefer kind-appropriate variants when multiple paths match a name.
 */
const KIND_KEYWORDS = {
  cone: ['cone', 'fire_cone', 'flame_cone', '.cone.'],
  range: ['projectile', 'ray', 'bolt', 'missile', 'breath'],
  marker: ['rune', 'circle', 'mark', 'symbol', 'persistent', 'loop', 'target', 'pentagram', 'magic_signs'],
  teleport: ['poof', 'portal', 'teleport', 'misty_step', 'door']
};

/**
 * Find a JB2A asset path matching this spell name, optionally preferring
 * variants whose path contains keywords appropriate for the given kind.
 *
 * Strategy:
 *   1. Collect candidate paths: exact-prefix `jb2a.{snake}.*` plus
 *      contains-anywhere `jb2a.{snake}` matches.
 *   2. If kindHint is provided and KIND_KEYWORDS has entries for it, filter
 *      candidates to those containing a kind-keyword. If any survive, use
 *      them. Otherwise fall back to the full candidate set.
 *   3. Pick the shortest path (usually the default/simplest variant alias).
 *
 * Returns the chosen path string, or null if no candidates.
 */
export function findJB2APath(spellName, kindHint = null) {
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
  const containsKey = `jb2a.${snake}`;
  const containsMatches = all.filter(p =>
    p.toLowerCase().includes(containsKey) && !p.toLowerCase().startsWith(prefix)
  );

  const allCandidates = [...exactMatches, ...containsMatches];
  if (!allCandidates.length) return null;

  // Kind-hint preference: filter to candidates whose path contains a keyword
  // appropriate for the kind. Only narrow if at least one survives.
  let pool = allCandidates;
  if (kindHint && KIND_KEYWORDS[kindHint]) {
    const keywords = KIND_KEYWORDS[kindHint];
    const preferred = allCandidates.filter(p => {
      const low = p.toLowerCase();
      return keywords.some(kw => low.includes(kw));
    });
    if (preferred.length) pool = preferred;
  }

  // Shortest path within the chosen pool — usually the simplest variant alias
  return pool.sort((a, b) => a.length - b.length)[0];
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
    const file = findJB2APath(item.name, kind);
    if (!file) {
      results.skipped.push(item.name);
      continue;
    }
    await setSpellMapping(item.name, { kind, file });
    results.mapped.push({ name: item.name, kind, file });
  }

  return results;
}
