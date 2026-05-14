/**
 * dnd5e API compatibility shim.
 *
 * dnd5e 5.1 deprecated `system.preparation.mode` → `system.method`
 * and `system.preparation.prepared` → `system.prepared`.
 * Reading the legacy fields still works but throws a deprecation warning
 * each access. Centralize the reads here so the rest of the module uses
 * a single accessor.
 */

export function spellMethod(item) {
  // 5.1+ shape
  if (typeof item?.system?.method === 'string') return item.system.method;
  // legacy
  return item?.system?.preparation?.mode ?? null;
}

export function spellPrepared(item) {
  if (typeof item?.system?.prepared === 'boolean') return item.system.prepared;
  return !!item?.system?.preparation?.prepared;
}

/**
 * For a Warlock pact-magic spell, return the pact slot level (e.g. 2 at L3).
 * For other spells, return the spell's base level.
 *
 * Used to group spells the way the dnd5e character sheet does: warlock pact
 * spells stack at pact slot level regardless of base level.
 */
export function effectiveSpellLevel(item, actor) {
  const baseLevel = Number(item?.system?.level ?? 0);
  if (baseLevel === 0) return 0; // cantrips
  const method = spellMethod(item);
  if (method === 'pact') {
    const pactLevel = Number(actor?.system?.spells?.pact?.level ?? baseLevel);
    return pactLevel > 0 ? pactLevel : baseLevel;
  }
  return baseLevel;
}

export function isPactMagic(item) {
  return spellMethod(item) === 'pact';
}
