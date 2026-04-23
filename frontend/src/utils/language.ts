const LANG_LABELS: Record<string, string> = {
  hi:  'Hindi',
  en:  'English',
  mr:  'Marathi',
  ta:  'Tamil',
  te:  'Telugu',
  bn:  'Bengali',
  gu:  'Gujarati',
  kn:  'Kannada',
  pa:  'Punjabi',
  or:  'Odia',
  bho: 'Bhojpuri',
}

/** Returns display label for a language code or full-name (handles legacy "Hindi" values). */
export function langLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const key = code.trim().toLowerCase()
  // Legacy full-name stored in DB (e.g. "Hindi" → look up by lowercased label)
  const byLabel = Object.entries(LANG_LABELS).find(([, v]) => v.toLowerCase() === key)
  if (byLabel) return byLabel[1]
  return LANG_LABELS[code] ?? code
}
