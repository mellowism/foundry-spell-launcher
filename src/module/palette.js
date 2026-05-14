import { MODULE_ID, getSpellLibrary } from './settings.js';
import { castSpell } from './cast.js';
import { openConfigureDialog } from './configure-dialog.js';
import { effectiveSpellLevel, isPactMagic } from './dnd5e-compat.js';

let _instance = null;

/**
 * Build the per-actor spell list grouped by spell level.
 * Returns ALL of the actor's spells (mapped + unmapped) so the GM sees
 * everything and can configure mappings inline.
 */
function buildActorSpellList(token) {
  const actor = token?.actor;
  if (!actor) return { tokenId: token?.id ?? null, actorName: null, groups: [] };

  const library = getSpellLibrary();
  const items = actor.items?.contents ?? actor.items ?? [];

  const byLevel = new Map();
  for (const item of items) {
    if (item?.type !== 'spell') continue;
    const level = effectiveSpellLevel(item, actor);
    const pact = isPactMagic(item);
    const libEntry = library[item.name];
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push({
      name: item.name,
      icon: item.img || 'icons/svg/mystery-man.svg',
      mapped: !!libEntry,
      kind: libEntry?.kind,
      file: libEntry?.file,
      pact
    });
  }

  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const groups = sortedLevels.map(level => {
    const spells = byLevel.get(level);
    // De-dupe by name (DDB import sometimes creates duplicates per prep mode)
    const seen = new Set();
    const unique = spells.filter(s => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
    const anyPact = unique.some(s => s.pact);
    const label = level === 0
      ? 'Cantrips'
      : anyPact
        ? `Pact Magic — ${ordinal(level)} Level`
        : `${ordinal(level)} Level`;
    return { level, label, spells: unique };
  });

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
      frame: true,
      positioned: true
    },
    position: {
      width: 380,
      height: 'auto'
    }
  };

  constructor(options = {}) {
    const token = options.token ?? null;
    const data = buildActorSpellList(token);
    // Diagnostic: confirm library + mapping at render time so we can debug
    // if all spells render as unmapped or if mapping is failing.
    const library = getSpellLibrary();
    console.log('[foundry-spell-launcher] palette render', {
      libraryKeys: Object.keys(library),
      actor: data.actorName,
      spellCount: data.groups.reduce((acc, g) => acc + g.spells.length, 0),
      mappedCount: data.groups.reduce((acc, g) => acc + g.spells.filter(s => s.mapped).length, 0)
    });
    const titleSuffix = data.actorName ? ` — ${data.actorName}` : '';
    super({
      ...options,
      window: { ...(options.window ?? {}), title: `Spells${titleSuffix}` }
    });
    this._token = token;
    this._data = data;
  }

  async _renderHTML() {
    if (!this._data.groups.length) {
      const msg = this._data.actorName
        ? `<div class="palette-empty">${this._data.actorName} has no spell items.</div>`
        : `<div class="palette-empty">No token selected.</div>`;
      return msg;
    }

    const groupsHtml = this._data.groups.map(group => {
      const cells = group.spells.map(s => {
        const safeName = (s.name ?? '').replace(/"/g, '&quot;');
        const tooltip = s.mapped ? safeName : `${safeName} — click to configure`;
        const cls = s.mapped ? 'spell-icon mapped' : 'spell-icon unmapped';
        return `<button type="button" class="${cls}" data-spell-name="${safeName}" data-mapped="${s.mapped}" data-tooltip="${tooltip}">
          <img src="${s.icon}" alt="${safeName}" onerror="this.src='icons/svg/mystery-man.svg'" />
        </button>`;
      }).join('');
      return `<div class="palette-group">
        <div class="group-label">${group.label}</div>
        <div class="group-row">${cells}</div>
      </div>`;
    }).join('');

    return `<div class="palette-shell">${groupsHtml}</div>`;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;
    content.querySelectorAll('button[data-spell-name]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const name = btn.dataset.spellName;
        if (!name) return;
        const mapped = btn.dataset.mapped === 'true';
        if (mapped) {
          await this.close();
          await castSpell(name, { token: this._token });
        } else {
          // Open configure dialog. Keep palette open behind so user can return.
          openConfigureDialog(name, {
            onSaved: () => {
              // Re-render palette to reflect new mapping
              this._data = buildActorSpellList(this._token);
              this.render({ force: true });
            }
          });
        }
      });
    });
  }
}

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
