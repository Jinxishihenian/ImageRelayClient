import copy from 'copy-to-clipboard'

export function copyTextToClipboard(text: string): void {
  // 使用成熟库统一处理浏览器差异，避免在 WebView / 非安全上下文里反复踩兼容坑。
  const copied = copy(text)

  if (!copied) {
    throw new Error('当前浏览器不支持自动复制，请手动复制下载链接')
  }
}
