import fs from 'fs';
import path from 'path';

const fixturesDir = path.resolve('docs/fixtures/v2');

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    return;
  }

  let changed = false;

  function processVariables(vars) {
    if (!Array.isArray(vars)) return;
    for (const v of vars) {
      if (v.type === 'image') {
        v.type = 'asset';
        v.assetKind = 'image';
        changed = true;
      }
      if (v.type === 'list' && v.itemSchema?.fields) {
        for (const [key, field] of Object.entries(v.itemSchema.fields)) {
          if (field.type === 'image') {
            field.type = 'asset';
            changed = true;
          }
        }
      }
    }
  }

  function processPublicAPI(api) {
    if (!Array.isArray(api)) return;
    for (const p of api) {
      if (p.type === 'image') {
        p.type = 'asset';
        changed = true;
      }
    }
  }

  if (json.variables) processVariables(json.variables);
  if (json.publicAPI) processPublicAPI(json.publicAPI);

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    console.log('Migrated', filePath);
  }
}

function walk(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith('.json')) {
      migrateFile(full);
    }
  }
}

walk(fixturesDir);
