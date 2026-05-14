import { MODULE_ID, getSpellLibrary } from './settings.js';
import { findSpellItem } from './auto-map.js';

const PERSIST_PREFIX = `${MODULE_ID}::`;

/**
 * Use dnd5e's built-in AbilityTemplate preview to let the user place a
 * rotating cone template (same UX as Automated Animations). Returns the
 * placed MeasuredTemplate document, or null if no template config or the
 * user cancelled.
 */
async function previewSpellTemplate(actor, spellName) {
  try {
    const AT =
      globalThis.dnd5e?.canvas?.AbilityTemplate
      ?? game?.dnd5e?.canvas?.AbilityTemplate
      ?? game?.system?.canvas?.AbilityTemplate
      ?? CONFIG?.DND5E?.canvas?.AbilityTemplate
      ?? null;

    // Deep diagnostic on the class itself — see exactly which factory
    // methods are available in this dnd5e version.
    const classMethods = AT
      ? Object.getOwnPropertyNames(AT).filter(n => typeof AT[n] === 'function')
      : [];
    console.log(`[${MODULE_ID}] AbilityTemplate class`, {
      resolved: !!AT,
      classMethods,
      hasFromItem: typeof AT?.fromItem === 'function',
      hasFromActivity: typeof AT?.fromActivity === 'function'
    });
    if (!AT) return null;

    const item = findSpellItem(actor, spellName);
    if (!item) {
      console.warn(`[${MODULE_ID}] previewSpellTemplate: item not found`, { actor: actor?.name, spellName });
      return null;
    }

    // dnd5e 5.x moved templates to the Activities system. A spell can have
    // multiple activities (cast, attack, save, ...) and the template is on
    // a specific activity. Find the activity with a template config.
    const activities = item.system?.activities;
    const activityList = activities?.contents
      ?? (activities instanceof Map ? [...activities.values()] : Object.values(activities ?? {}));
    const activityWithTemplate = activityList?.find?.(a => a?.target?.template?.type);
    console.log(`[${MODULE_ID}] item activities`, {
      hasActivities: !!activities,
      activityCount: activityList?.length,
      activityTypes: activityList?.map?.(a => a?.type),
      foundTemplateActivity: !!activityWithTemplate,
      templateType: activityWithTemplate?.target?.template?.type
    });

    let template = null;

    // Strategy 1: dnd5e 5.x — fromActivity
    if (!template && typeof AT.fromActivity === 'function' && activityWithTemplate) {
      try {
        template = AT.fromActivity(activityWithTemplate);
        console.log(`[${MODULE_ID}] fromActivity result`, { template: !!template });
      } catch (e) {
        console.warn(`[${MODULE_ID}] fromActivity threw`, e);
      }
    }

    // Strategy 2: legacy dnd5e 3.x/4.x — fromItem
    if (!template && typeof AT.fromItem === 'function') {
      try {
        template = AT.fromItem(item);
        console.log(`[${MODULE_ID}] fromItem result`, { template: !!template });
      } catch (e) {
        console.warn(`[${MODULE_ID}] fromItem threw`, e);
      }
    }

    if (!template) {
      console.warn(`[${MODULE_ID}] previewSpellTemplate: no factory produced a template`);
      return null;
    }

    const placed = await template.drawPreview();
    if (!placed) {
      console.log(`[${MODULE_ID}] drawPreview returned falsy (user cancelled?)`);
      return null;
    }
    return Array.isArray(placed) ? placed[0] : placed;
  } catch (e) {
    console.error(`[${MODULE_ID}] previewSpellTemplate failed`, e);
    return null;
  }
}

/**
 * Compute the cone tip (far edge midpoint) in pixel coordinates from a
 * placed MeasuredTemplate document. Used to anchor a stretchTo-style
 * animation to the template's actual placement.
 */
function templateTip(templateDoc) {
  const dims = canvas?.dimensions;
  const pixelsPerUnit = dims ? dims.size / dims.distance : 1;
  const lengthPx = (templateDoc.distance ?? 15) * pixelsPerUnit;
  const rad = (templateDoc.direction ?? 0) * (Math.PI / 180);
  return {
    x: (templateDoc.x ?? 0) + Math.cos(rad) * lengthPx,
    y: (templateDoc.y ?? 0) + Math.sin(rad) * lengthPx
  };
}

function ensureSequencer() {
  if (typeof Sequencer === 'undefined' || !Sequencer?.Crosshair) {
    ui.notifications.error(game.i18n.localize('SPELL_LAUNCHER.Notifications.SequencerMissing'));
    return false;
  }
  return true;
}

/**
 * Cast a spell by name.
 *
 * @param {string} name — spell name (must exist in library)
 * @param {{ token?: Token }} [opts] — caster token. Falls back to controlled[0].
 */
export async function castSpell(name, opts = {}) {
  const lib = getSpellLibrary();
  const spell = lib[name];
  if (!spell) {
    ui.notifications.error(game.i18n.format('SPELL_LAUNCHER.Notifications.SpellNotFound', { name }));
    return;
  }
  if (!ensureSequencer()) return;

  const source = opts.token ?? canvas.tokens.controlled[0];
  // Marker spells can be cast without a caster (Moonbeam doesn't need source).
  // Self / melee / cone / range / teleport all need a caster.
  if (spell.kind !== 'marker' && !source) {
    ui.notifications.warn(game.i18n.localize('SPELL_LAUNCHER.Palette.SelectCaster'));
    return;
  }

  // Self-kind: animation on caster, no crosshair needed
  if (spell.kind === 'self') {
    await new Sequence()
      .effect()
        .file(spell.file)
        .attachTo(source)
        .scaleToObject(1.5)
      .play();
    return;
  }

  // Cone-kind: use dnd5e's AbilityTemplate preview when available — gives
  // the AA-style rotatable cone-template UX. The animation then plays
  // anchored at the template's origin, stretched to the template's tip.
  // Falls back to crosshair + stretchTo if dnd5e API or spell item is
  // unavailable.
  if (spell.kind === 'cone') {
    const placed = await previewSpellTemplate(source?.actor, name);
    if (placed) {
      // AA's approach (verified via theripper93/autoanimations source):
      // atLocation(template) + rotateTowards(template) + explicit size.
      // The size width = templateDistance × distancePixels, height = same for
      // cone (template.distance × pixelsPerUnit). This makes the JB2A asset
      // fill the actual cone shape rather than stretching as a line.
      const dims = canvas?.dimensions;
      const distancePixels = dims ? dims.size / dims.distance : 1;
      const lengthPx = (placed.distance ?? 15) * distancePixels;
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(placed, { cacheLocation: true })
          .rotateTowards(placed, { cacheLocation: true })
          .size({ width: lengthPx, height: lengthPx })
        .play();
      try {
        await placed.delete?.();
      } catch (_) { /* ignore — template may have already been removed */ }
      return;
    }
    console.log(`[${MODULE_ID}] cone: template preview unavailable, falling back to crosshair`);
    // Fall through to crosshair-based fallback below
  }

  let crosshairResult;
  try {
    crosshairResult = await Sequencer.Crosshair.show({
      icon: { texture: 'icons/svg/target.svg' }
    });
  } catch (e) {
    console.error(`[${MODULE_ID}] Crosshair error`, e);
    return;
  }
  if (!crosshairResult) return;

  // Resolve crosshair-token if click landed on one
  const crosshairToken = crosshairResult?.id
    ? canvas.tokens.get(crosshairResult.id)
    : null;

  switch (spell.kind) {
    case 'range':
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(source)
          .stretchTo(crosshairToken ?? crosshairResult)
        .play();
      return;

    case 'melee':
      // Touch / on-target spells (Cure Wounds, Shocking Grasp). Plays on the
      // target token if the crosshair hit one; falls back to the clicked
      // location otherwise. Uses attachTo so the effect follows the target
      // if it moves during play.
      if (crosshairToken) {
        await new Sequence()
          .effect()
            .file(spell.file)
            .attachTo(crosshairToken)
            .scaleToObject(1.5)
          .play();
      } else {
        await new Sequence()
          .effect()
            .file(spell.file)
            .atLocation(crosshairResult)
            .scaleToObject(1.5)
          .play();
      }
      return;

    case 'cone':
      // stretchTo gives an AA-template-like cone: the asset stretches from
      // caster to crosshair point. Length scales with click distance, which
      // matches the GM's intent (click far = long cone, click near = short).
      // Previous impl (atLocation + rotateTowards + scaleToObject(3)) used a
      // fixed scale rotated toward the click, which often looked like a
      // square/target rather than a directional cone.
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(source)
          .stretchTo(crosshairResult)
        .play();
      return;

    case 'marker': {
      // If crosshair hit a token, attach the marker to the token so it
      // follows when moved (Hunter's Mark on a fleeing enemy). Otherwise
      // anchor at the clicked location (Moonbeam, Entangle).
      const anchorId = crosshairToken?.id
        ?? `${Math.round(crosshairResult.x ?? 0)},${Math.round(crosshairResult.y ?? 0)}`;
      const seqName = `${PERSIST_PREFIX}${name}::${anchorId}`;
      const existing = Sequencer.EffectManager.getEffects({ name: seqName });
      if (existing.length) {
        await Sequencer.EffectManager.endEffects({ name: seqName });
        ui.notifications.info(game.i18n.format('SPELL_LAUNCHER.Notifications.MarkerRemoved', { name }));
        return;
      }
      const seq = new Sequence()
        .effect()
          .name(seqName)
          .file(spell.file)
          .scaleToObject(1.5)
          .persist();
      if (crosshairToken) {
        seq.attachTo(crosshairToken);
      } else {
        seq.atLocation(crosshairResult);
      }
      await seq.play();
      return;
    }

    case 'teleport': {
      // Play poof at source, poof at destination, then actually move the
      // caster token to the click point. Snap to grid so token aligns.
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(source)
          .scaleToObject(1.5)
        .effect()
          .file(spell.file)
          .atLocation(crosshairResult)
          .scaleToObject(1.5)
          .delay(150)
        .play();
      // Move token after animation starts. Snap to grid.
      try {
        const gridSize = canvas?.dimensions?.size ?? 100;
        const tw = source?.document?.width ?? 1;
        const th = source?.document?.height ?? 1;
        const offsetX = (tw * gridSize) / 2;
        const offsetY = (th * gridSize) / 2;
        // crosshairResult.x/y are the center coords; convert to top-left
        const targetX = Math.round((crosshairResult.x - offsetX) / gridSize) * gridSize;
        const targetY = Math.round((crosshairResult.y - offsetY) / gridSize) * gridSize;
        await source.document.update(
          { x: targetX, y: targetY },
          { animation: { duration: 0 } }
        );
      } catch (e) {
        console.warn(`[${MODULE_ID}] teleport: token move failed`, e);
      }
      return;
    }

    default:
      console.warn(`[${MODULE_ID}] Unknown spell kind: ${spell.kind}`);
  }
}
