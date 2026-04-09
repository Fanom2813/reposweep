/**
 * Settings persistence using Sciter's built-in Storage API.
 * Data persists automatically — no manual JSON serialization.
 */

import * as Storage from "@storage";

let storage = null;

function getStorage() {
  if (!storage) {
    const path = URL.toPath(__DIR__ + "reposweep.db");
    storage = Storage.open(path, true);
    if (!storage.root) {
      storage.root = {};
    }
  }
  return storage;
}

export function loadState() {
  const s = getStorage();
  return s.root.state || null;
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
