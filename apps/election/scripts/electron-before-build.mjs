// The renderer is fully bundled by Vite. The only native main-process module
// required at runtime is explicitly listed in package.json's build.files.
// Avoid package-manager tree discovery here: this workspace uses pnpm links,
// while Electron Builder otherwise falls back to a host npm that may not exist.
export default async function beforeBuild() {
  return false;
}
