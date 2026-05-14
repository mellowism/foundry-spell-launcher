import { MODULE_ID, SPELL_KINDS, setSpellMapping, removeSpellMapping, getSpellLibrary } from './settings.js';
import { inferKindFromSpell, findJB2APath, findSpellItem } from './auto-map.js';

export class SpellConfigureDialog extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'spell-launcher-configure',
    classes: ['spell-launcher-configure'],
    tag: 'form',
    window: {
      frame: true,
      positioned: true
    },
    position: {
      width: 460,
      height: 'auto'
    }
  };

  constructor(options = {}) {
    const name = options.spellName ?? '';
    const existing = getSpellLibrary()[name];
    super({
      ...options,
      window: { ...(options.window ?? {}), title: `Configure spell: ${name}` }
    });
    this._spellName = name;
    this._actor = options.actor ?? null;
    this._currentKind = existing?.kind ?? 'range';
    this._currentFile = existing?.file ?? '';
    this._onSaved = options.onSaved ?? null;
  }

  async _renderHTML() {
    const kindOptions = SPELL_KINDS.map(k => {
      const sel = k === this._currentKind ? ' selected' : '';
      return `<option value="${k}"${sel}>${k}</option>`;
    }).join('');
    const file = this._currentFile.replace(/"/g, '&quot;');
    const hasExisting = !!getSpellLibrary()[this._spellName];
    const hasActor = !!this._actor;

    return `
      <div class="cfg-row">
        <label>Spell name</label>
        <div class="cfg-readonly">${this._spellName}</div>
      </div>
      ${hasActor ? `
      <div class="cfg-row cfg-autodetect">
        <button type="button" class="cfg-autodetect-btn">
          <i class="fas fa-magic"></i> Auto-detect from spell metadata + JB2A
        </button>
        <div class="cfg-hint">Reads spell properties on the actor and searches JB2A for matching assets.</div>
      </div>
      ` : ''}
      <div class="cfg-row">
        <label for="cfg-kind">Kind</label>
        <select id="cfg-kind" name="kind">${kindOptions}</select>
        <div class="cfg-hint">
          <strong>range</strong> = projectile (Fire Bolt) ·
          <strong>cone</strong> = cone from caster (Burning Hands) ·
          <strong>marker</strong> = persistent rune on target (Hunter's Mark, Moonbeam) ·
          <strong>teleport</strong> = poof at caster + destination (Misty Step)
        </div>
      </div>
      <div class="cfg-row">
        <label for="cfg-file">Sequencer / JB2A asset path</label>
        <input id="cfg-file" type="text" name="file" value="${file}" placeholder="jb2a.spell_name.color" />
        <div class="cfg-hint">
          Use Sequencer Database Viewer to find correct paths.
          <button type="button" class="cfg-browse">Open Sequencer DB Viewer</button>
        </div>
      </div>
      <div class="cfg-actions">
        ${hasExisting ? '<button type="button" class="cfg-delete">Remove mapping</button>' : '<span></span>'}
        <div class="cfg-actions-right">
          <button type="button" class="cfg-cancel">Cancel</button>
          <button type="button" class="cfg-save">Save</button>
        </div>
      </div>
    `;
  }

  async _replaceHTML(html, content) {
    content.innerHTML = html;

    content.querySelector('.cfg-autodetect-btn')?.addEventListener('click', () => {
      if (!this._actor) return;
      const item = findSpellItem(this._actor, this._spellName);
      if (!item) {
        ui.notifications.warn(`${this._spellName} not found on ${this._actor.name}.`);
        return;
      }
      const kind = inferKindFromSpell(item);
      const file = findJB2APath(this._spellName, kind);
      const kindSel = content.querySelector('#cfg-kind');
      const fileInp = content.querySelector('#cfg-file');
      if (kindSel) kindSel.value = kind;
      if (fileInp) fileInp.value = file ?? fileInp.value;
      this._currentKind = kind;
      this._currentFile = file ?? this._currentFile;
      if (file) {
        ui.notifications.info(`Detected: kind=${kind}, file=${file}`);
      } else {
        ui.notifications.warn(`Detected kind=${kind} but no JB2A asset matched "${this._spellName}". Browse manually.`);
      }
    });

    content.querySelector('.cfg-browse')?.addEventListener('click', () => {
      try {
        if (typeof Sequencer?.DatabaseViewer?.show === 'function') {
          Sequencer.DatabaseViewer.show();
        } else {
          ui.notifications.error('Sequencer Database Viewer not available.');
        }
      } catch (e) {
        console.error(`[${MODULE_ID}] DatabaseViewer error`, e);
      }
    });

    content.querySelector('.cfg-cancel')?.addEventListener('click', () => this.close());

    content.querySelector('.cfg-delete')?.addEventListener('click', async () => {
      await removeSpellMapping(this._spellName);
      ui.notifications.info(`Removed mapping for ${this._spellName}`);
      await this.close();
      this._onSaved?.();
    });

    content.querySelector('.cfg-save')?.addEventListener('click', async () => {
      const kind = content.querySelector('#cfg-kind')?.value?.trim();
      const file = content.querySelector('#cfg-file')?.value?.trim();
      if (!kind || !SPELL_KINDS.includes(kind)) {
        ui.notifications.warn(`Invalid kind. Pick one of: ${SPELL_KINDS.join(', ')}`);
        return;
      }
      if (!file) {
        ui.notifications.warn('Asset path is required.');
        return;
      }
      await setSpellMapping(this._spellName, { kind, file });
      ui.notifications.info(`Saved mapping for ${this._spellName}`);
      await this.close();
      this._onSaved?.();
    });
  }
}

export function openConfigureDialog(spellName, opts = {}) {
  const dlg = new SpellConfigureDialog({ spellName, ...opts });
  return dlg.render({ force: true });
}
