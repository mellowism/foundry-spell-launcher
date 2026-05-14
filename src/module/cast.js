import { MODULE_ID, getSpellLibrary } from './settings.js';

const PERSIST_PREFIX = `${MODULE_ID}::`;

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
