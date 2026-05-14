import { MODULE_ID, getSpellLibrary } from './settings.js';
import { castSpell } from './cast.js';

let _instance = null;

export class SpellPalette extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'spell-launcher-palette',
    classes: ['spell-launcher-palette'],
    tag: 'div',
    // v0.1.3 DIAGNOSTIC: frame: true gives the palette window chrome
    // (title bar + close button) so we can confirm rendering visually.
    // Will switch back to frame: false once positioning is verified.
    window: {
      frame: true,
      title: 'Spells',
      positioned: true
    },
    position: {
      width: 360,
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
  console.log(`[${MODULE_ID}] togglePalette`, { position, hadInstance: !!_instance?.rendered });
  if (_instance?.rendered) {
    await _instance.close();
    _instance = null;
    return;
  }
  _instance = new SpellPalette();
  // v0.1.3 DIAGNOSTIC: ignore caller position, force center-screen so we
  // can verify rendering works independent of token-HUD positioning.
  const renderOpts = { force: true, position: { left: 300, top: 300 } };
  await _instance.render(renderOpts);
  // Diagnostic: confirm the element is in DOM after render
  await new Promise(r => setTimeout(r, 50));
  const el = document.querySelector('#spell-launcher-palette');
  console.log(`[${MODULE_ID}] palette DOM after render:`, el ? {
    exists: true,
    rect: el.getBoundingClientRect(),
    classes: el.className,
    parent: el.parentElement?.tagName,
    visible: el.offsetParent !== null
  } : { exists: false });
}
