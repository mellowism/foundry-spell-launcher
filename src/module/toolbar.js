import { MODULE_ID } from './settings.js';
import { togglePalette } from './palette.js';

export function onRenderTokenHUD(hud, htmlOrJq) {
  if (!game.user.isGM) return;
  const root = htmlOrJq instanceof HTMLElement ? htmlOrJq : htmlOrJq?.[0] ?? htmlOrJq;
  if (!root?.querySelector) return;

  const tooltip = game.i18n.localize('SPELL_LAUNCHER.Controls.Open');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'control-icon spell-launcher-token-button';
  button.dataset.tooltip = tooltip;
  button.innerHTML = '<i class="fas fa-magic"></i>';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const token = hud.object;
    const rect = button.getBoundingClientRect();
    try {
      await togglePalette({
        position: { left: rect.right + 8, top: rect.top },
        token
      });
    } catch (e) {
      console.error(`[${MODULE_ID}] togglePalette error`, e);
    }
  });

  const rightCol = root.querySelector('.col.right') ?? root.querySelector('[class*="right"]') ?? root;
  rightCol.appendChild(button);
}
