import { MODULE_ID, registerSettings } from './settings.js';
import { onRenderTokenHUD } from './toolbar.js';

Hooks.once('init', () => {
  console.log(`[${MODULE_ID}] init`);
});

Hooks.once('ready', () => {
  registerSettings();
  console.log(`[${MODULE_ID}] ready — user=${game.user?.name} gm=${game.user?.isGM}`);
});

Hooks.on('renderTokenHUD', onRenderTokenHUD);
