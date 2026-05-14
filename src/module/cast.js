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
  if (spell.kind !== 'marker' && !source) {
    ui.notifications.warn(game.i18n.localize('SPELL_LAUNCHER.Palette.SelectCaster'));
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

  switch (spell.kind) {
    case 'range':
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(source)
          .stretchTo(crosshairResult)
        .play();
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
      const id = crosshairResult.id
        ?? `${Math.round(crosshairResult.x ?? 0)},${Math.round(crosshairResult.y ?? 0)}`;
      const seqName = `${PERSIST_PREFIX}${name}::${id}`;
      const existing = Sequencer.EffectManager.getEffects({ name: seqName });
      if (existing.length) {
        await Sequencer.EffectManager.endEffects({ name: seqName });
        ui.notifications.info(game.i18n.format('SPELL_LAUNCHER.Notifications.MarkerRemoved', { name }));
        return;
      }
      await new Sequence()
        .effect()
          .name(seqName)
          .file(spell.file)
          .atLocation(crosshairResult)
          .scaleToObject(1.5)
          .persist()
        .play();
      return;
    }

    case 'teleport':
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
      return;

    default:
      console.warn(`[${MODULE_ID}] Unknown spell kind: ${spell.kind}`);
  }
}
