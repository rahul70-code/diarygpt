// Simple JSON file-based storage for diary entries
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../data/entries.json");

function readAll() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeAll(entries) {
  fs.writeFileSync(DB_PATH, JSON.stringify(entries, null, 2));
}

export function getAllEntries() {
  return readAll();
}

export function getEntryById(id) {
  return readAll().find((e) => e.id === id) || null;
}

export function saveEntry(entry) {
  const entries = readAll();
  entries.push(entry);
  writeAll(entries);
  return entry;
}

export function updateEntry(id, updates) {
  const entries = readAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() };
  writeAll(entries);
  return entries[idx];
}

export function deleteEntry(id) {
  const entries = readAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  writeAll(entries);
  return true;
}
