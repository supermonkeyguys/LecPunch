const asHttpsUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('外部地址无效。');
  }
  if (url.protocol !== 'https:') throw new Error('仅允许打开 HTTPS 外部地址。');
  return url.toString();
};

/** External links are opened by Electron main process; renderer navigation is never used. */
export const openExternalUrl = async (value: string) => {
  const url = asHttpsUrl(value);
  if (!window.lecpunchDesktop?.openExternal) throw new Error('请在 LecPunch 桌面端中打开外部博客地址。');
  await window.lecpunchDesktop.openExternal(url);
};

/** Saving a weekly draft is always an explicit local save dialog action. */
export const saveMarkdownLocally = async (filename: string, content: string) => {
  if (!window.lecpunchDesktop?.saveMarkdown) throw new Error('请在 LecPunch 桌面端中保存 Markdown 文件。');
  return window.lecpunchDesktop.saveMarkdown({ filename, content });
};
