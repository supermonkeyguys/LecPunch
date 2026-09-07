import { existsSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const children = [];
let closing = false;

const closeAll = (code = 0) => {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exit(code);
};

const run = (command, args, options = {}) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
  children.push(child);
  child.on('exit', (code) => {
    if (!closing && code && code !== 0) closeAll(code);
  });
  return child;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const compileElectron = () => {
  // Do one synchronous compile before Electron starts. A previous dev session
  // can leave a stale .electron/preload.js behind; a watch process alone lets
  // Electron launch against that old bridge and the renderer then crashes when
  // a newly added IPC method is missing.
  const result = spawnSync(process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json'], { stdio: 'inherit', shell: false });
  if (result.status !== 0) throw new Error('Electron 主进程与 preload 编译失败，未启动窗口。');
};
const rendererReady = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (existsSync('.electron/main.js') && existsSync('.electron/preload.js')) {
      try {
        const response = await fetch('http://127.0.0.1:5174');
        if (response.ok) return;
      } catch {
        // Vite is still starting.
      }
    }
    await delay(250);
  }
  throw new Error('Electron renderer did not start within 30 seconds.');
};

process.on('SIGINT', () => closeAll());
process.on('SIGTERM', () => closeAll());

compileElectron();
run(process.execPath, ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json', '--watch']);
run(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort']);

try {
  await rendererReady();
  // The interactive developer desktop uses Electron's normal production-like
  // GPU and sandbox path. Do not force software rendering here: that workaround
  // is only useful in headless automation and can paint a blank window locally.
  const diagnosticsPath = path.join(process.cwd(), '.local-test-window.jsonl');
  writeFileSync(diagnosticsPath, '');
  const electronArgs = [
    './node_modules/electron/cli.js',
    '.',
    `--lecpunch-window-diagnostic-path=${diagnosticsPath}`
  ];
  const electron = run(process.execPath, electronArgs, {
    env: {
      ...process.env,
      LECPUNCH_WINDOW_DIAGNOSTIC_PATH: diagnosticsPath
    }
  });
  electron.on('exit', (code, signal) => {
    if (closing) return;
    console.error(`[Election dev] Electron exited before the test was closed (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
    closeAll(typeof code === 'number' && code !== 0 ? code : 1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  closeAll(1);
}
