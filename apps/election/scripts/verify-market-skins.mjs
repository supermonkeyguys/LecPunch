import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'bongocat', 'standard', 'market');
const safe = (value) => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
  && !value.split(/[\\/]/).some((part) => !part || part === '..');
const exists = (base, relative) => safe(relative) && fs.existsSync(path.join(base, relative));
const ids = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const failures = [];
for (const id of ids) {
  const base = path.join(root, id);
  try {
    const model = JSON.parse(fs.readFileSync(path.join(base, 'cat.model3.json'), 'utf8'));
    const refs = model.FileReferences || {};
    const required = [refs.Moc, ...(Array.isArray(refs.Textures) ? refs.Textures : []), ...(refs.Physics ? [refs.Physics] : []), ...(refs.DisplayInfo ? [refs.DisplayInfo] : []), ...(refs.Pose ? [refs.Pose] : [])];
    if (!required.length || required.some((file) => !exists(base, file))) throw new Error('模型必需引用缺失');
    if (refs.Expressions || refs.Motions) throw new Error('瘦身后的模型仍声明未随包的动作或表情');
    if (!exists(base, 'resources/background.png') || !exists(base, 'resources/cover.png') || !exists(base, 'layout.json')) throw new Error('背景、封面或布局文件缺失');
    console.log(`PASS ${id}`);
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`MARKET_SKIN_PREFLIGHT=${ids.length - failures.length}/${ids.length}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
