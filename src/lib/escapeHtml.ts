/**
 * escapeHtml — sanitizes user-supplied strings before inserting into HTML templates.
 * Use whenever building HTML strings (e.g., PDF print windows) with user-controlled data.
 *
 * Escapes: & < > " '
 */
export function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
