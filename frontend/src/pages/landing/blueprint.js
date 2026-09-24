/**
 * Design tokens for the landing page's blueprint look. Kept here rather than in the global theme:
 * nothing behind the sign-in uses them.
 *
 * Text colours are chosen for at least 4.5:1 contrast on `navy`.
 */
export const BP = Object.freeze({
  navy: '#0b2440',
  navyDeep: '#071a30',
  brand: '#1f4e79',
  ink: '#e0f2fe',
  muted: '#a9cbe6',
  line: 'rgba(186, 230, 253, 0.10)',
  lineMajor: 'rgba(186, 230, 253, 0.22)',
  stroke: 'rgba(186, 230, 253, 0.75)',
  accent: '#fb923c',
  paper: '#f5f9fc',
  paperLine: 'rgba(31, 78, 121, 0.07)',
})

/** Headlines: a geometric grotesk, falling back to the app's Inter and then the system. */
export const DISPLAY_FONT = '"Space Grotesk", Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

/** Callouts and labels, as on a drawing. */
export const MONO_FONT = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/** Pin and legend colour per incident type; every use is paired with the type's name. */
export const TYPE_COLORS = Object.freeze({
  FACILITIES: '#fbbf24',
  IT: '#38bdf8',
  SAFETY: '#fb7185',
  OTHER: '#c4b5fd',
})

/** A drafting grid: minor lines every 24px, major every 120px. */
export function gridBackground({ base = BP.navy, minor = BP.line, major = BP.lineMajor } = {}) {
  return {
    backgroundColor: base,
    backgroundImage: [
      `linear-gradient(${major} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${major} 1px, transparent 1px)`,
      `linear-gradient(${minor} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
  }
}
