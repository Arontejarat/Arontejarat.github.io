/** Print only the approved preview, retaining the application's self-hosted font and RTL styles. */
export function printDocument(element: HTMLElement | null) {
  if (!element) return
  const win = window.open('', '_blank')
  if (!win) throw new Error('پنجره چاپ مسدود شد؛ اجازه باز شدن پنجره را بدهید.')
  win.document.documentElement.lang = 'fa'
  win.document.documentElement.dir = 'rtl'
  win.document.title = 'چاپ سند'
  document.querySelectorAll('link[rel="stylesheet"],style').forEach((node) => win.document.head.appendChild(node.cloneNode(true)))
  const css = win.document.createElement('style')
  css.textContent = '@page{size:A4;margin:16mm}body{background:white!important;padding:24px;color:#171c26}button,.no-print{display:none!important}article{max-width:100%;overflow:visible}img{max-width:100%}'
  win.document.head.appendChild(css)
  win.document.body.appendChild(element.cloneNode(true))
  const ready = Promise.all(Array.from(win.document.images).map((img) => img.decode().catch(() => undefined)))
  void ready.then(() => win.document.fonts.ready).then(() => { win.focus(); win.print() })
}
