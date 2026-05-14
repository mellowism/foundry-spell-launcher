import { MODULE_ID, getSpellLibrary } from './settings.js';
import { castSpell } from './cast.js';

let _instance = null;

/**
 * Build the per-actor spell list grouped by spell level.
 * Returns: { tokenId, actorName, groups: [{ level, label, spells: [...] }] }
 * where each spell has { name, icon, kind, file }.
 */
function buildActorSpellList(token) {
  const actor = token?.actor;
  if (!actor) return { tokenId: token?.id ?? null, actorName: null, groups: [] };

  const library = getSpellLibrary();
  const items = actor.items?.contents ?? actor.items ?? [];

  // Collect actor's spell items keyed by level
  const byLevel = new Map();
  for (const item of items) {
    if (item?.type !== 'spell') continue;
    const libEntry = library[item.name];
    if (!libEntry) continue; // skip spells not mapped in library
    const level = Number(item.system?.level ?? 0);
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push({
      name: item.name,
      icon: item.img || 'icons/svg/mystery-man.svg',
      kind: libEntry.kind,
      file: libEntry.file
    });
  }

  // Sort levels ascending
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const groups = sortedLevels.map(level => ({
    level,
    label: level === 0 ? 'Cantrips' : `${ordinal(level)} Level`,
    spells: byLevel.get(level).sort((a, b) => a.name.localeCompare(b.name))
  }));

  return { tokenId: token.id, actorName: actor.name, groups };
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

  constructor(options = {}) {
    super(options);
    this._token = options.token ?? null;
    this._data = buildActorSpellList(this._token);
  }

  async _renderHTML() {
    if (!this._data.groups.length) {
      const msg = this._data.actorName
        ? `<div class="palette-empty">No mapped spells on ${this._data.actorName}.</div>`
        : `<div class="palette-empty">No token selected.</div>`;
      return msg;
    }

    const groupsHtml = this._data.groups.map(group => {
      const cells = group.spells.map(s => {
        const safeName = (s.name ?? '').replace(/"/g, '&quot;');
        return `<button type="button" class="spell-icon" data-spell-name="${safeName}" data-tooltip="${safeName}">
          <img src="${s.icon}" alt="${safeName}" onerror="this.src='icons/svg/mystery-man.svg'" />
        </button>`;
      }).join('');
      return `<div class="palette-group">
        <div class="group-label">${group.label}</div>
        <div class="group-row">${cells}</div>
      </div>`;
    }).join('');

    return `<div class="palette-shell"><div class="palette-actor">${this._data.actorName}</div>${groupsHtml}</div>`;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;
    content.querySelectorAll('button[data-spell-name]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const name = btn.dataset.spellName;
        if (!name) return;
        await this.close();
        await castSpell(name, { token: this._token });
      });
    });
  }
}

/**
 * Open the palette for the given token, or toggle if already open.
 *
 * @param {object} params
 * @param {{ left?: number, top?: number }} [params.position]
 * @param {Token} [params.token] — the Token whose actor's spells are shown
 */
export async function togglePalette({ position, token } = {}) {
  console.log(`[${MODULE_ID}] togglePalette`, { position, token: token?.id, hadInstance: !!_instance?.rendered });
  if (_instance?.rendered) {
    await _instance.close();
    _instance = null;
    return;
  }
  _instance = new SpellPalette({ token });
  const renderOpts = { force: true };
  if (position && (Number.isFinite(position.left) || Number.isFinite(position.top))) {
    renderOpts.position = {};
    if (Number.isFinite(position.left)) renderOpts.position.left = Math.max(8, position.left);
    if (Number.isFinite(position.top)) renderOpts.position.top = Math.max(8, position.top);
  }
  await _instance.render(renderOpts);
}
