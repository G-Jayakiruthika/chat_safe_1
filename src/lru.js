'use strict';

/**
 * Small LRU cache. A Map keeps insertion order, so the first key is the least recently used.
 * @param {number} limit
 */
function createLru(limit) {
  const map = new Map();
  return {
    has(key) {
      return map.has(key);
    },
    get(key) {
      if (!map.has(key)) return undefined;
      const v = map.get(key);
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > limit) map.delete(map.keys().next().value);
    },
    get size() {
      return map.size;
    },
  };
}

module.exports = { createLru };
