import { MODULE_ID, registerSettings } from './settings.js';
import { registerSceneControls } from './toolbar.js';

Hooks.once('init', () => {
  console.log(`[${MODULE_ID}] init`);
  registerSceneControls();
});

Hooks.once('ready', () => {
  registerSettings();
  console.log(`[${MODULE_ID}] ready — user=${game.user?.name} gm=${game.user?.isGM}`);
});
