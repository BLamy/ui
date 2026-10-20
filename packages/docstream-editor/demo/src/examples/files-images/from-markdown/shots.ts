/* Two "screenshots" as SVG files held in memory, the way a desktop app holds files next to a document. */
function shot(title: string, hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 80% 64%)"/><stop offset="1" stop-color="hsl(${hue + 40} 70% 40%)"/></linearGradient></defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect x="32" y="32" width="576" height="48" rx="8" fill="#fff" opacity=".92"/>
  <rect x="32" y="100" width="360" height="268" rx="8" fill="#fff" opacity=".92"/>
  <rect x="412" y="100" width="196" height="120" rx="8" fill="#fff" opacity=".92"/>
  <text x="52" y="63" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="#16161d">${title}</text>
</svg>`
}

/** Path as written in the document → file contents. */
export const SHOTS: Record<string, string> = {
  "./shots/checkout.svg": shot("Checkout", 200),
  "./shots/cart.svg": shot("Cart drawer", 20),
  "./shots/receipt.svg": shot("Receipt", 140),
}

const urls = new Map<string, string>()

/** A blob: URL for a file in SHOTS (made once), or undefined for any other path. */
export function blobUrlFor(path: string): string | undefined {
  const svg = SHOTS[path]
  if (svg === undefined) return undefined
  let url = urls.get(path)
  if (!url) urls.set(path, (url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))))
  return url
}
