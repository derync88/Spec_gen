/**
 * Catalogue store (FR-C1). Loads the curated archetype catalogue from
 * catalogue.json (the structured projection of the three seed docs), seeds it
 * into the `archetypes` table, and serves it. The catalogue is DATA: improving
 * an archetype means editing catalogue.json + re-seeding, with no code change
 * (NFR-C4).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from '../../db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached = null;

/** Read + cache the raw catalogue file. */
export function loadCatalogue() {
  if (!cached) {
    cached = JSON.parse(readFileSync(join(__dirname, 'catalogue.json'), 'utf8'));
  }
  return cached;
}

/** Map of archetype id -> archetype, from the file. */
export function archetypeMap() {
  const map = new Map();
  for (const a of loadCatalogue().archetypes) map.set(a.id, a);
  return map;
}

/**
 * FR-C1.3: resolve hard `requires` dependencies transitively. Given seed ids,
 * returns the full set including everything they (transitively) require.
 * Pure over the provided map so it is unit-testable.
 */
export function resolveRequires(ids, map = archetypeMap()) {
  const out = new Set();
  const visit = (id) => {
    if (out.has(id)) return;
    const node = map.get(id);
    if (!node) return;
    out.add(id);
    for (const dep of node.requires || []) visit(dep);
  };
  for (const id of ids) visit(id);
  return [...out];
}

/**
 * Seed/refresh the archetypes table from catalogue.json (upsert by id).
 * Blueprints are stored as archetypes with layer='blueprint' so the store is
 * single-source; their members live in composes_with and required devices/
 * foundations in requires.
 */
export async function seedCatalogue() {
  const cat = loadCatalogue();
  const rows = [...cat.archetypes];

  // Project blueprints into archetype rows.
  for (const b of cat.blueprints) {
    rows.push({
      id: b.id, layer: 'blueprint', axis: 'blueprint', name: b.name,
      user_says: [], classifier_hints: [], brings_fr: [], leans_nfr: [],
      watch_for: [], composes_with: b.composedOf || [],
      requires: [...(b.composedOf || []), ...(b.defaultDevices || [])],
      signals: { architectureShape: b.architectureShape || null },
      checkability: null, default_prescription: null,
      prescription_overrides: [], maturity: b.maturity || null,
    });
  }

  let count = 0;
  for (const a of rows) {
    await query(
      `INSERT INTO archetypes
         (id, layer, axis, name, user_says, classifier_hints, brings_fr, leans_nfr,
          watch_for, composes_with, requires, signals, checkability,
          default_prescription, prescription_overrides, maturity, catalogue_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         layer=EXCLUDED.layer, axis=EXCLUDED.axis, name=EXCLUDED.name,
         user_says=EXCLUDED.user_says, classifier_hints=EXCLUDED.classifier_hints,
         brings_fr=EXCLUDED.brings_fr, leans_nfr=EXCLUDED.leans_nfr,
         watch_for=EXCLUDED.watch_for, composes_with=EXCLUDED.composes_with,
         requires=EXCLUDED.requires, signals=EXCLUDED.signals,
         checkability=EXCLUDED.checkability, default_prescription=EXCLUDED.default_prescription,
         prescription_overrides=EXCLUDED.prescription_overrides, maturity=EXCLUDED.maturity,
         catalogue_version=EXCLUDED.catalogue_version`,
      [
        a.id, a.layer, a.axis, a.name,
        JSON.stringify(a.user_says || []), JSON.stringify(a.classifier_hints || []),
        JSON.stringify(a.brings_fr || []), JSON.stringify(a.leans_nfr || []),
        JSON.stringify(a.watch_for || []), JSON.stringify(a.composes_with || []),
        JSON.stringify(a.requires || []), JSON.stringify(a.signals || {}),
        a.checkability || null, a.default_prescription || null,
        JSON.stringify(a.prescription_overrides || []), a.maturity || null,
        cat.version,
      ]
    );
    count += 1;
  }
  return { version: cat.version, count };
}

/** List all archetypes (excludes blueprints), ordered by layer. */
export async function listArchetypes() {
  const { rows } = await query(
    `SELECT * FROM archetypes WHERE layer <> 'blueprint' ORDER BY layer, name`
  );
  return rows;
}

/** List blueprints (FR-C2). */
export async function listBlueprints() {
  const { rows } = await query(
    `SELECT id, name, composes_with AS composed_of, requires, maturity, signals
     FROM archetypes WHERE layer = 'blueprint' ORDER BY name`
  );
  return rows;
}

/** Fetch archetype rows by id (DB-backed). */
export async function getArchetypesByIds(ids) {
  if (!ids || !ids.length) return [];
  const { rows } = await query('SELECT * FROM archetypes WHERE id = ANY($1)', [ids]);
  return rows;
}
