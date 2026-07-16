// 送信済みリマインドの記録 — サーバー再起動しても同じ通知を二重送信しない
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.join(__dirname, '..', '..', 'data', 'notified.local.json');

export class SentLog {
  constructor(filePath = DEFAULT_PATH) {
    this.filePath = filePath;
    this.entries = {};
    if (existsSync(filePath)) {
      try {
        this.entries = JSON.parse(readFileSync(filePath, 'utf8'));
      } catch {
        this.entries = {};
      }
    }
  }

  has(key) {
    return key in this.entries;
  }

  markSent(key) {
    this.entries[key] = new Date().toISOString();
    this.#prune();
    writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  /** 90日より古い記録は掃除する */
  #prune() {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(this.entries)) {
      if (new Date(v).getTime() < cutoff) delete this.entries[k];
    }
  }
}
