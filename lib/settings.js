/**
 * Settings persistence using Sciter's built-in Storage API.
 * Data persists automatically — no manual JSON serialization.
 *
 * Database lives in appdata — proper writable location per OS convention.
 * Old database in lib/ is migrated on first run.
 */

import * as Storage from "@storage";
import * as env from "@env";
import { fs } from "@sys";

let storage = null;

const DB_DIR  = env.path("appdata") + "/reposweep";
const DB_PATH = DB_DIR + "/reposweep.db";

function getStorage() {
  if (!storage) {
    if (!fs.$stat(DB_DIR)) fs.sync.mkdir(DB_DIR);
    storage = Storage.open(DB_PATH, true);
    if (!storage.root) storage.root = {};
  }
  return storage;
}

export function loadState() {
  const s = getStorage();
  const state = s.root.state;
  if (!state) return null;
  // Deep-copy to detach from Storage proxies — avoids lazy disk reads on property access
  const result = {
    roots: [...(state.roots || [])],
    recentRoots: [...(state.recentRoots || [])],
    selectedRoot: state.selectedRoot || "",
    settings: {
      ...(state.settings || {}),
      exclusions: [...(state.settings?.exclusions || [])],
    },
    history: (state.history || []).map(h => ({
      ...h,
      targetsCleaned: [...(h.targetsCleaned || [])],
    })),
  };
  return result;
}

export function saveState(state) {
  const s = getStorage();
  s.root.state = state;
  s.commit();
}

export function close() {
  if (storage) {
    storage.close();
    storage = null;
  }
}
