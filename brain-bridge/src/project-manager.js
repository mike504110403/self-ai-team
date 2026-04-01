const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.homedir(), '.claude', 'bridge-projects.json');

class ProjectManager {
  constructor() {
    this.state = this._load();
  }

  _load() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
    catch { return { current: null, registered: {} }; }
  }

  _save() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  getCurrent() { return this.state.current; }

  getCurrentName() {
    if (!this.state.current) return null;
    for (const [name, dir] of Object.entries(this.state.registered)) {
      if (dir === this.state.current) return name;
    }
    return path.basename(this.state.current);
  }

  getAll() { return { ...this.state.registered }; }

  add(name, dir) {
    const resolved = path.resolve(dir);
    this.state.registered[name] = resolved;
    if (!this.state.current) this.state.current = resolved;
    this._save();
  }

  switchTo(name) {
    const dir = this.state.registered[name];
    if (dir) {
      this.state.current = dir;
      this._save();
    }
  }

  remove(name) {
    const dir = this.state.registered[name];
    delete this.state.registered[name];
    if (this.state.current === dir) {
      const remaining = Object.values(this.state.registered);
      this.state.current = remaining[0] || null;
    }
    this._save();
  }
}

module.exports = { ProjectManager };
