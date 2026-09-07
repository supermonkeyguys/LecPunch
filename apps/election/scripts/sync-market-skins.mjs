import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const electionRoot = path.resolve(scriptDir, '..');
const sourceRoot = process.env.LECPUNCH_SKIN_LIBRARY
  ? path.resolve(process.env.LECPUNCH_SKIN_LIBRARY)
  : path.join(process.env.USERPROFILE || process.env.HOME || electionRoot, 'Desktop', '皮肤库');
const destinationRoot = path.join(electionRoot, 'public', 'bongocat', 'standard', 'market');

// User-confirmed redistribution permission is recorded in NOTICE-SKINS.md.
// This table deliberately keeps the shipped IDs ASCII-only while preserving the
// original display names and attribution in the generated notice.
const skins = [
  ['aixiya', '艾瑟雅 · 标准模式', '艾瑟雅', '网友艾瑟雅'],
  ['ailixiya', '爱莉希雅 · 标准模式', '爱莉希雅', '宇痕冫'],
  ['power-cat', '动力小猫 · 标准模式', '动力小猫', '松露酱酱'],
  ['feibi', '菲比 · 标准模式', '菲比', '宇痕冫'],
  ['keli', '可莉 · 标准模式', '可莉', '喵小爷驾到'],
  ['liuying', '流萤 · 标准模式', '流萤', '宇痕冫'],
  ['luoxiaohei', '罗小黑 · 标准模式', '罗小黑', '源尘迷途'],
  ['nailin', '乃琳 · 标准模式', '乃琳', '奶淇琳周报'],
  ['pidan', '皮蛋 · 标准模式', '皮蛋', '不要舔我耳朵啊喂'],
  ['sangonomiya-kokomi', '珊瑚宫心海 · 标准模式', '珊瑚宫心海', '宇痕冫'],
  ['xiaoyao-sanren', '逍遥散人 · 标准模式', '逍遥散人', 'ST 咸猫'],
  ['red-panda-haohao', '小熊猫昊昊 · 标准模式', '小熊猫昊昊', '猫猫虫有啥坏心思呢'],
  ['oyama-mahiru', '绪山真寻 · 标准模式', '绪山真寻', '水無蝉羽'],
  ['zimin', '籽岷 · 标准模式', '籽岷', '是阿蚩哟'],
  ['ziyin', '子音 · 标准模式', '子音', '是阿蚩哟'],
  ['doro', 'doro - 标准模式', 'doro', '我是千秋秋']
];

const layoutFor = (label) => ({
  scene: 'standard',
  label,
  backgroundFile: 'resources/background.png',
  canvas: { width: 780, height: 520 },
  stage: { left: 0, bottom: 0, width: 780, height: 520 },
  model: { left: 84, bottom: 58, width: 612, height: 354 },
  menu: {
    anchorX: 630, anchorY: 180, scaleOffsetX: 0, scaleOffsetY: 0,
    actionOffsets: [{ x: -71, y: 65 }, { x: -126, y: 12 }, { x: -130, y: -55 }, { x: -79, y: -108 }, { x: -8, y: -129 }],
    spacing: 1, bubbleSize: 44
  },
  orbit: { right: 130, bottom: 92 },
  message: { left: 340, top: 10 },
  keys: { leftOverlays: [], rightOverlays: [] }
});

const safeRelativePath = (value) => typeof value === 'string' && value.length > 0
  && !path.isAbsolute(value) && !value.includes('\0') && !/[?#]/.test(value)
  && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.split(/[\\/]/).some((part) => !part || part === '..');
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copyFile = (fromRoot, toRoot, relative) => {
  if (!safeRelativePath(relative)) throw new Error(`不安全的资源路径：${String(relative)}`);
  const source = path.join(fromRoot, relative);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`缺少所需资源：${relative}`);
  const destination = path.join(toRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
const pngFiles = (root) => {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.png')
    .map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
};

if (!fs.existsSync(sourceRoot)) throw new Error(`未找到皮肤库：${sourceRoot}`);
fs.rmSync(destinationRoot, { recursive: true, force: true });
fs.mkdirSync(destinationRoot, { recursive: true });

const manifest = [];
for (const [id, sourceDirectory, label, author] of skins) {
  const source = path.join(sourceRoot, sourceDirectory);
  const destination = path.join(destinationRoot, id);
  const modelPath = path.join(source, 'cat.model3.json');
  if (!fs.existsSync(modelPath)) throw new Error(`${sourceDirectory}：缺少 cat.model3.json`);
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  const references = model?.FileReferences;
  if (!references || typeof references !== 'object' || !safeRelativePath(references.Moc)
    || !Array.isArray(references.Textures) || !references.Textures.length || !references.Textures.every(safeRelativePath)) {
    throw new Error(`${sourceDirectory}：cat.model3.json 的模型引用无效`);
  }
  const required = [references.Moc, ...references.Textures];
  for (const optional of ['Physics', 'DisplayInfo', 'Pose']) {
    if (references[optional] !== undefined) {
      if (!safeRelativePath(references[optional])) throw new Error(`${sourceDirectory}：${optional} 引用无效`);
      required.push(references[optional]);
    }
  }
  // Motions and Expressions are never consumed by Election. Remove their
  // references first, then omit their files and any audio they may reference.
  delete references.Expressions;
  delete references.Motions;

  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'cat.model3.json'), `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  for (const relative of [...new Set(required)]) copyFile(source, destination, relative);
  copyFile(source, destination, 'resources/background.png');
  copyFile(source, destination, 'resources/cover.png');
  const left = pngFiles(path.join(source, 'resources', 'left-keys'));
  const right = pngFiles(path.join(source, 'resources', 'right-keys'));
  for (const name of left) copyFile(source, destination, `resources/left-keys/${name}`);
  for (const name of right) copyFile(source, destination, `resources/right-keys/${name}`);
  const layout = layoutFor(label);
  layout.keys.leftOverlays = left.map((name) => path.basename(name, '.png'));
  layout.keys.rightOverlays = right.map((name) => path.basename(name, '.png'));
  fs.writeFileSync(path.join(destination, 'layout.json'), `${JSON.stringify(layout, null, 2)}\n`, 'utf8');
  manifest.push({ id, label, author, sourceDirectory, modelSha256: sha256(path.join(destination, 'cat.model3.json')), files: fs.readdirSync(destination, { recursive: true }).length });
}

fs.writeFileSync(path.join(destinationRoot, 'market-skin-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const notice = [
  '# LecPunch Election — 内置皮肤声明',
  '',
  '本安装包中的下列 16 套标准模式 Live2D 模型，来源于 Awesome-BongoCat 模型目录。',
  '用户于 2026-09-06 确认拥有本批模型随 LecPunch Election 安装包再分发的权限。',
  'Election 仅保留模型实际加载所需资源、背景、封面和键位贴图；未包含动作文件、音频或未使用表情。',
  '',
  '| 名称 | 原作者/发布者 | 来源 | 授权依据 |',
  '| --- | --- | --- | --- |',
  ...manifest.map((skin) => `| ${skin.label} | ${skin.author} | https://github.com/ayangweb/Awesome-BongoCat | 用户确认可随安装包再分发（2026-09-06） |`),
  '',
  '上游目录：https://github.com/ayangweb/Awesome-BongoCat',
  '模型版权及原作者署名仍归各原作者所有。'
].join('\n');
fs.writeFileSync(path.join(electionRoot, 'public', 'bongocat', 'NOTICE-SKINS.md'), `${notice}\n`, 'utf8');
console.log(`SYNCED_MARKET_SKINS=${manifest.length}`);
