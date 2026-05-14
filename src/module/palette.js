import { MODULE_ID, getSpellLibrary } from './settings.js';
import { castSpell } from './cast.js';
import { openConfigureDialog } from './configure-dialog.js';
import { effectiveSpellLevel, isPactMagic } from './dnd5e-compat.js';
import { autoMapActorSpells } from './auto-map.js';

const PERSIST_PREFIX = `${MODULE_ID}::`;

async function clearAllPersistentEffects() {
  try {
    const mgr = Sequencer?.EffectManager;
    if (!mgr) {
      ui.notifications.warn('Sequencer EffectManager unavailable');
      return 0;
    }
    const all = mgr.getEffects?.() ?? [];
    const ours = all.filter(e => {
      const n = e?.data?.name ?? e?.name ?? '';
      return String(n).startsWith(PERSIST_PREFIX);
    });
    for (const e of ours) {
      const n = e?.data?.name ?? e?.name;
      if (n) await mgr.endEffects({ name: n });
    }
    return ours.length;
  } catch (err) {
    console.error(`[${MODULE_ID}] clearAllPersistentEffects`, err);
    return 0;
  }
}

let _instance = null;

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
    const titleSuffix = data.actorName ? ` — ${data.actorName}` : '';
    super({
      ...options,
      window: { ...(options.window ?? {}), title: `Spells${titleSuffix}` }
    });
    this._token = token;
    this._data = data;
  }

  /**
   * Run auto-map silently against this actor's unmapped spells, then rebuild
   * the spell list so the render reflects new mappings. Idempotent — only
   * adds mappings for spells that have no library entry.
   */
  async _autoMapOnOpen() {
    const actor = this._token?.actor;
    if (!actor) return;
    try {
      const result = await autoMapActorSpells(actor);
      if (result.mapped.length > 0) {
        console.log(`[${MODULE_ID}] auto-map on open: +${result.mapped.length} mapped, ${result.skipped.length} skipped`, result);
        // Rebuild data with new library state
        this._data = buildActorSpellList(this._token);
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] auto-map on open failed`, e);
    }
  }

  _refresh() {
    this._data = buildActorSpellList(this._token);
    return this.render({ force: true });
  }

  async _renderHTML() {
    if (!this._data.groups.length) {
      const msg = this._data.actorName
        ? `<div class="palette-empty">${this._data.actorName} has no spell items.</div>`
        : `<div class="palette-empty">No token selected.</div>`;
      return msg;
    }

    const totalSpells = this._data.groups.reduce((a, g) => a + g.spells.length, 0);
    const unmappedCount = this._data.groups.reduce((a, g) => a + g.spells.filter(s => !s.mapped).length, 0);
    const statsHtml = unmappedCount > 0
      ? `<span class="palette-stats">${unmappedCount} of ${totalSpells} unmapped</span>`
      : `<span class="palette-stats all-mapped">All ${totalSpells} spells mapped ✓</span>`;
    const headerHtml = `<div class="palette-header">
      ${statsHtml}
      <div class="palette-header-actions">
        ${unmappedCount > 0 ? `<button type="button" class="palette-automap" data-tooltip="Auto-map all unmapped spells using Sequencer/JB2A database">
          <i class="fas fa-magic"></i> Auto-map
        </button>` : ''}
        <button type="button" class="palette-clear-effects" data-tooltip="Remove all persistent spell effects (Moonbeam, Hunter's Mark, Entangle, etc.) currently on the scene">
          <i class="fas fa-broom"></i> Clear effects
        </button>
      </div>
    </div>`;

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

    return `<div class="palette-shell">${headerHtml}${groupsHtml}</div>`;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;

    content.querySelector('.palette-clear-effects')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const count = await clearAllPersistentEffects();
      ui.notifications.info(`Cleared ${count} persistent effect(s).`);
    });

    content.querySelector('.palette-automap')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const actor = this._token?.actor;
      if (!actor) {
        ui.notifications.warn('No actor on this token.');
        return;
      }
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mapping...';
      try {
        const result = await autoMapActorSpells(actor);
        const mapped = result.mapped.length;
        const skipped = result.skipped.length;
        ui.notifications.info(`Auto-mapped ${mapped} spell(s). ${skipped} skipped (no JB2A asset found).`);
        if (skipped) {
          console.log(`[${MODULE_ID}] auto-map skipped (no JB2A match):`, result.skipped);
        }
        console.log(`[${MODULE_ID}] auto-map results:`, result);
      } catch (e) {
        console.error(`[${MODULE_ID}] auto-map error`, e);
        ui.notifications.error('Auto-map failed — see console.');
      }
      await this._refresh();
    });

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
          openConfigureDialog(name, {
            actor: this._token?.actor ?? null,
            onSaved: () => this._refresh()
          });
        }
      });
      // Right-click on any spell (mapped or unmapped) → edit mapping
      btn.addEventListener('contextmenu', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const name = btn.dataset.spellName;
        if (!name) return;
        openConfigureDialog(name, {
          actor: this._token?.actor ?? null,
          onSaved: () => this._refresh()
        });
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
  // Auto-map silently before render so the palette opens with everything
  // already mapped that we know how to map. Idempotent — touches only
  // spells with no library entry.
  await _instance._autoMapOnOpen();
  const renderOpts = { force: true };
  if (position && (Number.isFinite(position.left) || Number.isFinite(position.top))) {
    renderOpts.position = {};
    if (Number.isFinite(position.left)) renderOpts.position.left = Math.max(8, position.left);
    if (Number.isFinite(position.top)) renderOpts.position.top = Math.max(8, position.top);
  }
  await _instance.render(renderOpts);
}
