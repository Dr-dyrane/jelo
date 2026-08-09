import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRecentSearches,
  readRecentSearches,
  recordRecentSearch,
} from "@/lib/search/recent-searches";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test("recent searches are device-local, deduplicated and capped at six", () => {
  const storage = memoryStorage();
  for (const query of [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "  THREE  ",
  ]) {
    recordRecentSearch(storage, query);
  }
  assert.deepEqual(readRecentSearches(storage), [
    "THREE",
    "seven",
    "six",
    "five",
    "four",
    "two",
  ]);
});

test("recent searches can be cleared and tolerate malformed storage", () => {
  const storage = memoryStorage();
  recordRecentSearch(storage, "a");
  assert.deepEqual(readRecentSearches(storage), []);
  recordRecentSearch(storage, "acne");
  assert.deepEqual(clearRecentSearches(storage), []);
  assert.deepEqual(readRecentSearches(storage), []);
  storage.setItem("jelocare:global-search:recent:v1", "{bad");
  assert.deepEqual(readRecentSearches(storage), []);
});
