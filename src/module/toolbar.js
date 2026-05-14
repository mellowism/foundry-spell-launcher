import { MODULE_ID } from './settings.js';
import { togglePalette } from './palette.js';

const CATEGORY = 'spell-launcher';
const TOOL = 'spell-launcher-open';

export function registerSceneControls() {
  Hooks.on('getSceneControlButtons', (controls) => {
    const title = game.i18n.localize('SPELL_LAUNCHER.Controls.Title');
    const toolTitle = game.i18n.localize('SPELL_LAUNCHER.Controls.Open');

    const tool = {
      name: TOOL,
      title: toolTitle,
      icon: 'fas fa-hat-wizard',
      button: true,
      onChange: () => togglePalette(),
      // Some V13 builds still wire onClick; keep both as a no-op-safe alias.
      onClick: () => togglePalette()
    };

    const category = {
      name: CATEGORY,
      title,
      icon: 'fas fa-hat-wizard',
      layer: 'tokens',
      activeTool: TOOL,
      tools: { [TOOL]: tool }
    };

    if (Array.isArray(controls)) {
      controls.push(category);
    } else if (controls && typeof controls === 'object') {
      controls[CATEGORY] = category;
    }
  });
}
