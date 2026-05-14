import { MODULE_ID } from './settings.js';
import { togglePalette } from './palette.js';

/**
 * Token HUD button — open the spell palette positioned next to the clicked
 * button. Mirrors the "Assign Status Effects" flow: a single icon-button on
 * the Token HUD whose click opens an icon-grid palette beside it.
 *
 * Architectural rationale (v0.1.1):
 *   v0.1.0 registered a scene-controls toolbar category, but casting is a
 *   token-bound action — Token HUD is the natural home. The scene-controls
 *   path also tripped a V13 onClick→onChange deprecation warning when the
 *   category button was activated. Removed.
 */
export function onRenderTokenHUD(hud, htmlOrJq) {
  if (!game.user.isGM) return;
  const root = htmlOrJq instanceof HTMLElement ? htmlOrJq : htmlOrJq?.[0] ?? htmlOrJq;
  if (!root?.querySelector) return;

  const tooltip = game.i18n.localize('SPELL_LAUNCHER.Controls.Open');
  const button = document.createElement('button');
  button.type = 'button';
  // fa-magic is in FontAwesome Free (Foundry's bundled set). fa-hat-wizard
  // is Pro-only — was invisible on most installs in v0.1.1.
  button.className = 'control-icon spell-launcher-token-button';
  button.dataset.tooltip = tooltip;
  button.innerHTML = '<i class="fas fa-magic"></i>';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    console.log(`[${MODULE_ID}] token-HUD button clicked`);
    const rect = button.getBoundingClientRect();
    try {
      await togglePalette({ left: rect.right + 8, top: rect.top });
    } catch (e) {
      console.error(`[${MODULE_ID}] togglePalette error`, e);
    }
  });

  const rightCol = root.querySelector('.col.right') ?? root.querySelector('[class*="right"]') ?? root;
  rightCol.appendChild(button);
}
