/** True for a URL whose path ends in `.strudel` (query string and hash ignored). */
export function isStrudelFile(url: string): boolean {
  return /\.strudel(?:[?#]|$)/i.test(url.trim())
}

/** Fence languages that render as a Strudel player. */
export function isStrudelLanguage(language: string | null | undefined): boolean {
  return !!language && /^strudel$/i.test(language)
}
