import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const testsDir = path.join(desktopRoot, "electron", "__tests__");

const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

let successCount = 0;

for (const file of files) {
  const oldFilePath = path.join(testsDir, file);
  let content = fs.readFileSync(oldFilePath, "utf8");
  
  // Find first local import to determine target directory
  const imports = [...content.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)];
  if (imports.length === 0) {
      console.log(`[SKIP] No relative imports in ${file}`);
      continue;
  }

  let targetDir = null;
  for (const match of imports) {
      let relImport = match[1];
      relImport = relImport.replace(/renderer\/src/g, "gui")
                           .replace(/src\/main/g, "electron/main")
                           .replace(/src\/preload/g, "electron/preload")
                           .replace(/src\/shared/g, "shared");
      const absPath = path.resolve(testsDir, relImport);
      
      const dir = path.dirname(absPath);
      if (fs.existsSync(dir)) {
          targetDir = dir;
          break;
      }
  }

  if (!targetDir) {
      console.log(`[SKIP] Could not resolve target directory for ${file}`);
      continue;
  }
  
  const newFilePath = path.join(targetDir, file);
  
  content = content.replace(/from\s+["'](\.\.?\/[^"']+)["']/g, (match, p1) => {
      let correctedOldImport = p1.replace(/renderer\/src/g, "gui")
                                 .replace(/src\/main/g, "electron/main")
                                 .replace(/src\/preload/g, "electron/preload")
                                 .replace(/src\/shared/g, "shared");
                                 
      const absDepPath = path.resolve(testsDir, correctedOldImport);
      let newRelative = path.relative(targetDir, absDepPath).replace(/\\/g, '/');
      if (!newRelative.startsWith('.')) newRelative = './' + newRelative;
      
      return `from "${newRelative}"`;
  });
  
  fs.writeFileSync(newFilePath, content);
  fs.unlinkSync(oldFilePath);
  console.log(`Moved ${file} to ${path.relative(desktopRoot, targetDir)}`);
  successCount++;
}

console.log(`Successfully relocated ${successCount} files.`);
