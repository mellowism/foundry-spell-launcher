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
      const tooltip = s.name?.replace(/"/g, '&quot;') ?? '';
      const icon = s.icon ?? 'icons/svg/mystery-man.svg';
      return `<button type="button" class="spell-icon" data-spell-index="${i}" data-tooltip="${tooltip}">
        <img src="${icon}" alt="${tooltip}" />
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
 * Toggle the palette: open if closed, close if open. Position near the cursor
 * when opening so it appears where the GM was working.
 */
export async function togglePalette() {
  if (_instance?.rendered) {
    await _instance.close();
    return;
  }
  _instance = new SpellPalette();
  await _instance.render(true);
  // Position near cursor on first open. ApplicationV2 default-centers; nudge.
  const x = Math.max(8, (window.event?.clientX ?? window.innerWidth / 2) - 80);
  const y = Math.max(8, (window.event?.clientY ?? window.innerHeight / 2) + 12);
  _instance.setPosition({ left: x, top: y });
}
