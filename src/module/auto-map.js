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
  const name = String(item?.name ?? '').toLowerCase();

  // Name-based override takes precedence — some spells have visual conventions
  // that don't follow dnd5e metadata cleanly (Misty Step = self target +
  // movement, but visually we want teleport-kind).
  if (NAME_KIND_OVERRIDES[name]) {
    console.log(`[${MODULE_ID}] inferKind`, { name: item?.name, source: 'name-override', resolved: NAME_KIND_OVERRIDES[name] });
    return NAME_KIND_OVERRIDES[name];
  }

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

  console.log(`[${MODULE_ID}] inferKind`, {
    name: item?.name,
    templateType,
    affectsType,
    resolved: targetType
  });

  if (targetType === 'cone') return 'cone';
  if (['sphere', 'cube', 'cylinder', 'radius', 'square', 'circle'].includes(targetType)) return 'marker';
  if (targetType === 'self') return 'self';
  if (targetType === 'line' || targetType === 'wall') return 'range';
  if (['creature', 'enemy', 'ally', 'object', 'space'].includes(targetType)) {
    const units = String(range?.units ?? '').toLowerCase();
    if (units === 'touch' || units === 'self') return 'melee';
    return 'range';
  }
  // Touch units on a spell without a clear target type → melee
  const units = String(range?.units ?? '').toLowerCase();
  if (units === 'touch') return 'melee';
  if (units === 'self') return 'self';
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
  cone: ['.cone.', 'cone', 'fire_cone', 'flame_cone'],
  range: ['.projectile.', '.cast.', 'projectile', 'ray', 'bolt', 'missile', 'breath'],
  // Use no-dot 'loop' too so we catch 'eyeloop' / 'pulse_loop' etc. — JB2A
  // doesn't always wrap the descriptor in dots.
  marker: ['loop', 'rune', 'pentagram', 'magic_signs.rune', 'pulse'],
  teleport: ['.poof.', 'poof', 'portal', 'misty_step', 'door'],
  melee: ['.target.', '400px', 'healing.generic', '.complete.', 'cure_wounds.400px', 'loop'],
  self: ['.target.', '.aura.', 'loop', '400px', 'bless.400px', 'shield_spell', 'mage_armor']
};

/**
 * Paths to AVOID per kind. JB2A often ships multiple animation phases per
 * spell (intro/loop/outro, cast/projectile/complete). For persistent
 * (marker), buff (self), on-target (melee) kinds we want the loop/target
 * phases; the directional cast/projectile/intro phases tend to render
 * "between caster and target" which is wrong for these kinds.
 */
const KIND_BLOCK = {
  marker: ['.intro.', '.outro.', '.cast.', '.projectile.', '.complete_animation.', '.hit.'],
  melee: ['.intro.', '.projectile.', '.cast.', '.outro.', '.loop.'],
  self: ['.intro.', '.projectile.', '.outro.', '.cast.'],
  cone: ['.target.', '.complete.', '.hit.', '.loop.'],
  range: ['.loop.', '.idle.', '.persist.', '.outro.', '.intro.'],
  teleport: ['.loop.', '.idle.', '.persist.']
};

/**
 * Some spells have well-known mechanical/visual conventions that don't map
 * cleanly from raw dnd5e metadata. Override the inferred kind by spell name.
 * Keys are lowercased exact spell names.
 */
const NAME_KIND_OVERRIDES = {
  // Teleports
  "misty step": 'teleport',
  "dimension door": 'teleport',
  "thunder step": 'teleport',
  "word of recall": 'teleport',
  "blink": 'teleport',
  // Persistent area markers (drop at location, lasts)
  "moonbeam": 'marker',
  "spiritual weapon": 'marker',
  "spike growth": 'marker',
  "darkness": 'marker',
  "fog cloud": 'marker',
  "wall of fire": 'marker',
  "entangle": 'marker',
  "hunger of hadar": 'marker',
  "cloud of daggers": 'marker',
  "flaming sphere": 'marker',
  // Buff-on-target markers (persistent rune on a creature)
  "hex": 'marker',
  "hexblade's curse": 'marker',
  "bestow curse": 'marker',
  "faerie fire": 'marker',
  "bane": 'marker',
  // Hunter's Mark: AA's canonical is target-anchored (marks the quarry).
  // The "pulse on caster" Carl observed was likely from his Autorec config
  // (playOn: source) or no target selected at cast — not AA's default.
  "hunter's mark": 'marker',
  // Bless: AA's free DB ships intro + loop variants; type=static with
  // playOn determined by Autorec. We use melee for the typical "burst on
  // each ally" visual — attached to clicked ally.
  "bless": 'melee',
  "cure wounds": 'melee',
  "healing word": 'melee',
  "mass cure wounds": 'melee',
  "mass healing word": 'melee',
  "lesser restoration": 'melee',
  "aid": 'melee',
  "shield of faith": 'melee',
  // Self-buffs (animation on caster, no crosshair)
  "mage armor": 'self',
  "shield": 'self',
  "armor of agathys": 'self',
  "mirror image": 'self',
  "blur": 'self',
  "stoneskin": 'self',
  "haste": 'self',
  "false life": 'self',
  "spirit guardians": 'self',
  "holy aura": 'self',
  "sanctuary": 'self',
  "death ward": 'self'
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

  // Diagnostic — see what JB2A actually has for this spell name
  console.log(`[${MODULE_ID}] findJB2APath candidates`, {
    spell: spellName,
    kind: kindHint,
    candidates: allCandidates
  });

  let pool = allCandidates;

  // Block-list: remove kind-inappropriate variants (e.g. for marker kind,
  // exclude intro/projectile/cast assets that render directionally).
  if (kindHint && KIND_BLOCK[kindHint]) {
    const blocks = KIND_BLOCK[kindHint];
    const filtered = pool.filter(p => {
      const low = p.toLowerCase();
      return !blocks.some(b => low.includes(b));
    });
    // Only apply block list if we don't end up with nothing.
    if (filtered.length) pool = filtered;
  }

  // Kind-keyword preference: of remaining candidates, prefer ones that match
  // kind-appropriate keywords.
  if (kindHint && KIND_KEYWORDS[kindHint]) {
    const keywords = KIND_KEYWORDS[kindHint];
    const preferred = pool.filter(p => {
      const low = p.toLowerCase();
      return keywords.some(kw => low.includes(kw));
    });
    if (preferred.length) pool = preferred;
  }

  const chosen = pool.sort((a, b) => a.length - b.length)[0];
  console.log(`[${MODULE_ID}] findJB2APath`, {
    spell: spellName,
    kind: kindHint,
    chosen,
    candidatesCount: allCandidates.length,
    poolCount: pool.length
  });
  return chosen;
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
