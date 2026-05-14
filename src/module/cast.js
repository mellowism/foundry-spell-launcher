import { MODULE_ID, getSpellLibrary } from './settings.js';

const PERSIST_PREFIX = `${MODULE_ID}::`;

function ensureSequencer() {
  if (typeof Sequencer === 'undefined' || !Sequencer?.Crosshair) {
    ui.notifications.error(game.i18n.localize('SPELL_LAUNCHER.Notifications.SequencerMissing'));
    return false;
  }
  return true;
}

export async function castSpell(name) {
  const spell = getSpellLibrary().find(s => s.name === name);
  if (!spell) {
    ui.notifications.error(game.i18n.format('SPELL_LAUNCHER.Notifications.SpellNotFound', { name }));
    return;
  }
  if (!ensureSequencer()) return;

  const source = canvas.tokens.controlled[0];
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
  if (!crosshairResult) return; // user cancelled

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
      await new Sequence()
        .effect()
          .file(spell.file)
          .atLocation(source)
          .rotateTowards(crosshairResult)
          .scaleToObject(3)
        .play();
      return;

    case 'marker': {
      const id = crosshairResult.id
        ?? `${Math.round(crosshairResult.x ?? 0)},${Math.round(crosshairResult.y ?? 0)}`;
      const seqName = `${PERSIST_PREFIX}${spell.name}::${id}`;
      const existing = Sequencer.EffectManager.getEffects({ name: seqName });
      if (existing.length) {
        await Sequencer.EffectManager.endEffects({ name: seqName });
        ui.notifications.info(game.i18n.format('SPELL_LAUNCHER.Notifications.MarkerRemoved', { name: spell.name }));
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
