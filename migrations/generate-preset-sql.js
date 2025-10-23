#!/usr/bin/env node
/**
 * Generate SQL INSERT statements for default presets
 * Run this to generate migrations/002_seed_presets.sql
 */

const fs = require("fs");
const path = require("path");

// Import DEFAULT_PRESETS from the TypeScript source
// Note: This requires the presets to be exported as JS-compatible
const {
  DEFAULT_PRESETS,
} = require("../packages/data/src/repos/presets.default.ts");

function escapeSQL(str) {
  if (str === null || str === undefined) return "NULL";
  if (typeof str === "number") return str;
  if (typeof str === "boolean") return str;
  if (Array.isArray(str))
    return `ARRAY[${str.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")}]`;
  if (typeof str === "object")
    return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
  return `'${String(str).replace(/'/g, "''")}'`;
}

function generatePresetInserts() {
  const inserts = DEFAULT_PRESETS.map((preset) => {
    const fields = [
      `id`,
      `kind`,
      `name`,
      `description`,
      `icon`,
      `color`,
      `target_entity`,
      `is_system`,
      `core_field_config`,
      `custom_fields`,
      `field_order`,
      `created_at`,
      `updated_at`,
    ];

    const values = [
      escapeSQL(preset.id),
      escapeSQL(preset.kind),
      escapeSQL(preset.name),
      escapeSQL(preset.description),
      escapeSQL(preset.icon),
      escapeSQL(preset.color),
      escapeSQL(preset.targetEntity),
      preset.isSystem,
      escapeSQL(preset.coreFieldConfig),
      escapeSQL(preset.customFields),
      preset.fieldOrder ? escapeSQL(preset.fieldOrder) : "NULL",
      escapeSQL(preset.createdAt),
      escapeSQL(preset.updatedAt),
    ];

    return `INSERT INTO presets (${fields.join(", ")}) VALUES (${values.join(
      ", "
    )}) ON CONFLICT (id) DO NOTHING;`;
  }).join("\n");

  return `-- Auto-generated default presets
-- Generated: ${new Date().toISOString()}

${inserts}
`;
}

// Generate and write
const sql = generatePresetInserts();
const outputPath = path.join(__dirname, "002_seed_presets.sql");
fs.writeFileSync(outputPath, sql);
console.log(`✅ Generated ${outputPath}`);
console.log(`   ${DEFAULT_PRESETS.length} presets`);
