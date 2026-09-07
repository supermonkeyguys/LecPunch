# LecPunch Election

LecPunch 的 Electron 桌面端。它使用已有的 API 登录、打卡和积分接口；日报和周报保持在 GitHub 博客及统一报告仓库中，客户端只读取可公开访问的报告清单，不保存文章正文。

## 启动

```bash
pnpm --filter @lecpunch/election dev
```

首次安装 Electron 时，包管理器会下载与当前系统匹配的 Electron 运行时。生产构建使用：

```bash
pnpm --filter @lecpunch/election build
```

生成 Windows 64 位安装程序：

```bash
pnpm --filter @lecpunch/election package:win
```

默认安装文件生成在 `Downloads/LecPunch-Election-Installer/`，可安装到自选目录，并创建桌面和开始菜单快捷方式。可通过 `LECPUNCH_ELECTION_OUTPUT_DIR` 指定其它输出目录。

## 导入标准模式皮肤

在“个人设置 → 桌宠布局”选择“导入皮肤”。可选一个皮肤文件夹，也可直接选皮肤库根目录批量导入其一级子文件夹。

上游 BongoCat 格式无需自带 `layout.json`。每个皮肤至少需要：

- `cat.model3.json`
- `resources/background.png`
- `cat.model3.json` 中引用且属于必需资源的 Moc、Textures 与 Physics 文件

客户端会复制整个原始文件夹到本机数据目录，自动生成标准模式的 `layout.json`，并扫描 `resources/left-keys/*.png`、`resources/right-keys/*.png` 作为实际可响应的键位贴图。Expressions、Motions、音频和备用模型可缺失而不会阻断导入；若存在则原样保留。

原始素材会完整复制，皮肤通常包含多个纹理、动作和音频，导入会占用相应本机磁盘空间。重复导入同一文件夹会更新同一套已导入皮肤；该皮肤原有的本地布局覆盖会重置，内置默认皮肤及其布局不会受影响。

## 小猫商城与解锁边界

内置默认白猫永久免费。商城中的标准模式皮肤及用户本机导入的自定义皮肤均需使用 600 积分解锁；解锁记录与积分扣减由服务端账本保存，重复购买不会重复扣分。

客户端会依据服务端解锁状态灰显未解锁皮肤，但桌面程序的本地文件可能被篡改而显示未拥有皮肤。这是小团队的信任模型边界：购买与积分账本以服务器记录为准，客户端不把本地显示当作授权凭据。

随安装包内置的 16 套皮肤的作者、来源与用户确认的再分发依据记录在 `public/bongocat/NOTICE-SKINS.md`。打包前可运行 `node scripts/verify-market-skins.mjs` 校验每套模型的实际引用文件、背景、封面与布局文件；该脚本不替代真机 Live2D 加载验收。

复制 `.env.example` 为 `.env.local` 后，可配置：

- `VITE_API_BASE_URL`：LecPunch API 根地址，默认为 `http://43.138.244.158/api`。
- `VITE_REPORTS_MANIFEST_URL`：中央报告仓库中 `overview/current.json` 的公开地址。未配置时，报告页会显示接入提示而不会请求服务端。

## 统一报告清单

本地抓取与 AI 总结工具应把最新周报发布为类似下面的 JSON。桌面端可直接拉取该文件；学生博客正文仍只保存于其各自的 GitHub 仓库。

```json
{
  "weekKey": "2026-W35",
  "generatedAt": "2026-08-29T09:00:00.000Z",
  "members": [
    {
      "studentId": "student-001",
      "displayName": "张三",
      "status": "generated",
      "dailyCount": 5,
      "summary": "本周完成了……",
      "url": "https://github.com/your-org/weekly-reports/blob/main/reports/2026-W35/student-001.md"
    }
  ]
}
```

`status` 支持 `generated`、`missing` 和 `pending`。为避免浏览器跨域限制，推荐使用 GitHub Pages、公开对象存储或带 CORS 响应头的静态托管地址。
