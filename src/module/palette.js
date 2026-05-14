import { MODULE_ID, getSpellLibrary } from './settings.js';
import { castSpell } from './cast.js';

let _instance = null;

export class SpellPalette extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'spell-launcher-palette',
    classes: ['spell-launcher-palette'],
    tag: 'div',
    window: {
      frame: false,
      positioned: true
    },
    position: {
      width: 'auto',
      height: 'auto'
    }
  };

  async _renderHTML() {
    const spells = getSpellLibrary();
    if (!spells.length) {
      return `<div class="palette-empty">${game.i18n.localize('SPELL_LAUNCHER.Settings.SpellLibrary.Hint')}</div>`;
    }
    const cells = spells.map((s, i) => {
      const tooltip = (s.name ?? '').replace(/"/g, '&quot;');
      const icon = s.icon ?? 'icons/svg/mystery-man.svg';
      return `<button type="button" class="spell-icon" data-spell-index="${i}" data-tooltip="${tooltip}">
        <img src="${icon}" alt="${tooltip}" onerror="this.src='icons/svg/mystery-man.svg'" />
      </button>`;
    }).join('');
    return `<div class="palette-grid">${cells}</div>`;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;
    const spells = getSpellLibrary();
    content.querySelectorAll('button[data-spell-index]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = Number(btn.dataset.spellIndex);
        const spell = spells[idx];
        if (!spell) return;
        await this.close();
        await castSpell(spell.name);
      });
    });
  }
}

/**
 * Open or toggle the spell palette.
 *
 * @param {{ left?: number, top?: number }} [position] — desired top-left in px.
 *   Pass coordinates from the trigger element (e.g. Token HUD button rect) so
 *   the palette appears next to it, mirroring the Assign Status Effects flow.
 */
export async function togglePalette(position) {
  if (_instance?.rendered) {
    await _instance.close();
    return;
  }
  _instance = new SpellPalette();
  // V13 ApplicationV2: pass position via render options so the layout is
  // applied during the same frame as the initial render. Manual setPosition()
  // after render() crashes if the element hasn't attached to DOM yet
  // (offsetWidth read on null), which was the bug in v0.1.0.
  const renderOpts = { force: true };
  if (position && (Number.isFinite(position.left) || Number.isFinite(position.top))) {
    renderOpts.position = {};
    if (Number.isFinite(position.left)) renderOpts.position.left = Math.max(8, position.left);
    if (Number.isFinite(position.top)) renderOpts.position.top = Math.max(8, position.top);
  }
  await _instance.render(renderOpts);
}
