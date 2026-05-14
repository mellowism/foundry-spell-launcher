import { MODULE_ID } from './settings.js';

const PERSIST_PREFIX = `${MODULE_ID}::`;

/**
 * List active spell-launcher persistent effects with parsed metadata.
 */
function listOurPersistentEffects() {
  const mgr = Sequencer?.EffectManager;
  if (!mgr) return [];
  const all = mgr.getEffects?.() ?? [];
  return all
    .filter(e => {
      const n = e?.data?.name ?? e?.name ?? '';
      return String(n).startsWith(PERSIST_PREFIX);
    })
    .map(e => {
      const name = e?.data?.name ?? e?.name ?? '';
      const parts = name.split('::');
      // foundry-spell-launcher::SpellName::id-or-coords
      const spellName = parts[1] ?? 'Unknown';
      const locationLabel = parts[2] ?? '';
      const file = e?.data?.file ?? e?.file ?? '';
      return { seqName: name, spellName, locationLabel, file };
    });
}

async function endEffectByName(name) {
  try {
    await Sequencer?.EffectManager?.endEffects?.({ name });
  } catch (e) {
    console.error(`[${MODULE_ID}] endEffects failed for ${name}`, e);
  }
}

export class ManageEffectsDialog extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'spell-launcher-manage-effects',
    classes: ['spell-launcher-manage-effects'],
    tag: 'div',
    window: {
      frame: true,
      positioned: true,
      title: 'Active spell effects'
    },
    position: {
      width: 420,
      height: 'auto'
    }
  };

  constructor(options = {}) {
    super(options);
    this._effects = listOurPersistentEffects();
  }

  async _renderHTML() {
    if (!this._effects.length) {
      return `<div class="mfx-empty">No persistent spell effects on this scene.</div>`;
    }
    const rows = this._effects.map((e, i) => {
      const safeSpell = String(e.spellName).replace(/"/g, '&quot;');
      const safeLoc = String(e.locationLabel).replace(/"/g, '&quot;');
      return `<div class="mfx-row" data-index="${i}">
        <div class="mfx-name">${safeSpell}</div>
        <div class="mfx-loc">${safeLoc}</div>
        <button type="button" class="mfx-remove" data-tooltip="Remove this effect">×</button>
      </div>`;
    }).join('');
    return `
      <div class="mfx-shell">
        <div class="mfx-list">${rows}</div>
        <div class="mfx-actions">
          <button type="button" class="mfx-clear-all">Clear all (${this._effects.length})</button>
        </div>
      </div>
    `;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;
    content.querySelectorAll('.mfx-row').forEach(row => {
      const idx = Number(row.dataset.index);
      const removeBtn = row.querySelector('.mfx-remove');
      removeBtn?.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const eff = this._effects[idx];
        if (!eff) return;
        await endEffectByName(eff.seqName);
        ui.notifications.info(`Removed ${eff.spellName}`);
        await this._reload();
      });
    });
    content.querySelector('.mfx-clear-all')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const count = this._effects.length;
      for (const eff of this._effects) {
        await endEffectByName(eff.seqName);
      }
      ui.notifications.info(`Cleared ${count} effect(s).`);
      await this._reload();
    });
  }

  async _reload() {
    this._effects = listOurPersistentEffects();
    if (!this._effects.length) {
      await this.close();
      return;
    }
    return this.render({ force: true });
  }
}

export function openManageEffectsDialog() {
  const dlg = new ManageEffectsDialog();
  return dlg.render({ force: true });
}
