import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { keyframes, useTheme } from '@mui/material/styles'
import PriorityChip from '../../components/common/PriorityChip'
import StatusChip from '../../components/common/StatusChip'
import { INCIDENT_TYPES, PRIORITIES, labelFor } from '../../domain/incidentOptions'
import { STATUS_LABELS } from '../../domain/reportStatus'
import { BP, MONO_FONT, TYPE_COLORS } from './blueprint'
import { CAMPUS_INCIDENTS } from './campusIncidents'

/** How long each pin stays highlighted before the next one, when nobody is interacting. */
export const CYCLE_MS = 4000

const CARD_ID = 'blueprint-incident-card'

const pulse = keyframes`
  from { transform: scale(1); opacity: 0.75; }
  to { transform: scale(2.8); opacity: 0; }
`

const appear = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
`

/** "Safety incident in Hall B: Wet floor by the east stairs, high priority, in progress". */
function describe(incident) {
  const type = labelFor(INCIDENT_TYPES, incident.type)
  const priority = labelFor(PRIORITIES, incident.priority).toLowerCase()
  const status = STATUS_LABELS[incident.status].toLowerCase()
  return `${type} incident in ${incident.room}: ${incident.title}, ${priority} priority, ${status}`
}

/**
 * Where the card sits relative to its pin, in the plan's own percentages: below pins in the upper
 * part and above those near the bottom, and pulled inwards near either edge, so it never leaves the
 * plan. The pins in campusIncidents are placed so that no card covers another pin.
 */
function cardPlacement({ x, y }) {
  const vertical = y <= 55 ? { top: `calc(${y}% + 22px)` } : { bottom: `calc(${100 - y}% + 22px)` }
  if (x < 35) return { ...vertical, left: `calc(${x}% - 18px)` }
  if (x > 65) return { ...vertical, right: `calc(${100 - x}% - 18px)` }
  return { ...vertical, left: `${x}%`, transform: 'translateX(-50%)' }
}

function IncidentCard({ incident, floating }) {
  const typeLabel = labelFor(INCIDENT_TYPES, incident.type)
  return (
    <Paper
      id={CARD_ID}
      elevation={floating ? 10 : 0}
      sx={{
        width: floating ? 240 : '100%',
        p: 1.5,
        borderRadius: 2,
        ...(floating && { position: 'absolute', zIndex: 2, ...cardPlacement(incident) }),
        animation: `${appear} 240ms ease-out`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: TYPE_COLORS[incident.type], flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO_FONT, letterSpacing: '0.04em' }}>
          {typeLabel.toUpperCase()} · {incident.id}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
          {incident.ago}
        </Typography>
      </Stack>
      <Typography component="p" variant="subtitle2" sx={{ mt: 0.75, fontWeight: 700, lineHeight: 1.3 }}>
        {incident.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {incident.room}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        <StatusChip status={incident.status} />
        <PriorityChip priority={incident.priority} />
      </Stack>
    </Paper>
  )
}

/** The floor plan itself: walls, doors, furniture and callouts, drawn at 600 x 400. */
function FloorPlan() {
  const wall = { stroke: BP.stroke, strokeWidth: 2, fill: 'none', strokeLinecap: 'square' }
  const thin = { stroke: BP.stroke, strokeWidth: 1, fill: 'none', opacity: 0.55 }
  const door = { stroke: BP.stroke, strokeWidth: 1, fill: 'none', strokeDasharray: '3 3', opacity: 0.8 }
  const label = { fill: BP.ink, fontFamily: MONO_FONT, fontSize: 11, letterSpacing: '0.12em' }
  const note = { fill: BP.muted, fontFamily: MONO_FONT, fontSize: 9, letterSpacing: '0.08em' }

  return (
    <Box
      component="svg"
      viewBox="0 0 600 400"
      aria-hidden="true"
      focusable="false"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      {/* Overall dimension, as on a drawing. */}
      <path d="M20 9 H580 M20 5 V13 M580 5 V13" {...thin} />
      <text x="300" y="7" textAnchor="middle" {...note}>56.0 M</text>

      {/* Outer walls. */}
      <rect x="20" y="20" width="560" height="360" {...wall} strokeWidth={3} />

      {/* Corridor walls, with gaps for the doors. */}
      <path d="M20 150 H90 M120 150 H240 M270 150 H380 M410 150 H470 M580 150 H560" {...wall} />
      <path d="M20 230 H110 M150 230 H310 M340 230 H460 M490 230 H580" {...wall} />

      {/* Room walls. */}
      <path d="M190 20 V150 M330 20 V150 M470 20 V150 M260 230 V380 M400 230 V380" {...wall} />

      {/* Doors swing into the rooms. */}
      <path d="M90 150 V120 A30 30 0 0 1 120 150" {...door} />
      <path d="M240 150 V120 A30 30 0 0 1 270 150" {...door} />
      <path d="M380 150 V120 A30 30 0 0 1 410 150" {...door} />
      <path d="M310 230 V260 A30 30 0 0 0 340 230" {...door} />
      <path d="M460 230 V260 A30 30 0 0 0 490 230" {...door} />

      {/* Lab benches, a meeting table and screen, server racks. */}
      <rect x="40" y="66" width="130" height="16" {...thin} />
      <rect x="40" y="100" width="130" height="16" {...thin} />
      <rect x="214" y="66" width="92" height="46" rx="4" {...thin} />
      <path d="M222 30 H298" {...thin} strokeWidth={2} />
      {[346, 374, 402, 430].map((x) => (
        <rect key={x} x={x} y="58" width="22" height="70" {...thin} />
      ))}

      {/* East stairs. */}
      {Array.from({ length: 8 }, (_, i) => 52 + i * 12).map((y) => (
        <path key={y} d={`M482 ${y} H568`} {...thin} />
      ))}
      <path d="M525 136 V60 M519 68 L525 58 L531 68" {...thin} opacity={0.9} />

      {/* Atrium planter, kitchen counter, office desks. */}
      <circle cx="90" cy="320" r="30" {...thin} />
      <circle cx="90" cy="320" r="18" {...thin} />
      <path d="M272 250 H388 M272 250 V300" {...thin} strokeWidth={6} opacity={0.35} />
      {[[420, 280], [490, 280], [420, 330], [490, 330]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="56" height="28" {...thin} />
      ))}

      {/* Room names. */}
      <text x="34" y="44" {...label}>LAB 3</text>
      <text x="204" y="50" {...label}>ROOM 204</text>
      <text x="344" y="44" {...label}>SERVER RM</text>
      <text x="484" y="44" {...label}>E. STAIRS</text>
      <text x="300" y="195" textAnchor="middle" {...label}>HALL B</text>
      <text x="34" y="254" {...label}>ATRIUM</text>
      <text x="274" y="330" {...label}>KITCHEN</text>
      <text x="414" y="262" {...label}>OFFICES</text>

      {/* Title block. */}
      <text x="572" y="372" textAnchor="end" {...note}>ACME HQ · LEVEL 2 · A-102</text>
      <path d="M560 344 V364 M555 352 L560 344 L565 352" {...thin} opacity={0.9} />
      <text x="560" y="341" textAnchor="middle" {...note}>N</text>
    </Box>
  )
}

/**
 * The landing page's floor plan, with a pin per incident. One pin is always active and its report
 * card is shown; hovering, focusing or tapping a pin makes it active. With nobody interacting, the
 * active pin moves on every CYCLE_MS, unless the visitor prefers reduced motion, which also stops
 * the pins pulsing.
 *
 * On a phone-sized screen the card sits under the plan instead of over it, so it cannot overflow.
 */
export default function BlueprintMap({ incidents = CAMPUS_INCIDENTS }) {
  const theme = useTheme()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })
  const compact = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduceMotion || paused || incidents.length < 2) return undefined
    const timer = setInterval(() => setActive((i) => (i + 1) % incidents.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [reduceMotion, paused, incidents.length])

  const current = incidents[active]
  const types = INCIDENT_TYPES.filter((t) => incidents.some((i) => i.type === t.value))

  return (
    <Box>
      <Box
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
        }}
        sx={{
          position: 'relative',
          aspectRatio: '3 / 2',
          width: '100%',
          border: `1px solid ${BP.lineMajor}`,
          borderRadius: 2,
          bgcolor: 'rgba(7, 26, 48, 0.45)',
          boxShadow: `inset 0 0 0 6px rgba(7, 26, 48, 0.35)`,
        }}
      >
        <FloorPlan />
        {incidents.map((incident, i) => (
          <ButtonBase
            key={incident.id}
            aria-label={describe(incident)}
            aria-describedby={i === active ? CARD_ID : undefined}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            sx={{
              position: 'absolute',
              left: `${incident.x}%`,
              top: `${incident.y}%`,
              width: 36,
              height: 36,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              zIndex: i === active ? 3 : 1,
              '&::before, &::after': {
                content: '""',
                position: 'absolute',
                width: 14,
                height: 14,
                borderRadius: '50%',
              },
              '&::before': {
                bgcolor: TYPE_COLORS[incident.type],
                boxShadow: `0 0 0 3px ${BP.navy}, 0 0 0 ${i === active ? 5 : 4}px ${i === active ? BP.ink : TYPE_COLORS[incident.type]}`,
                transform: i === active ? 'scale(1.2)' : 'none',
                transition: 'transform 160ms ease-out',
              },
              '&::after': {
                border: `2px solid ${TYPE_COLORS[incident.type]}`,
                animation: `${pulse} 2.4s ease-out infinite`,
                animationDelay: `${i * 0.45}s`,
              },
              '&.Mui-focusVisible': { outline: `2px solid ${BP.ink}`, outlineOffset: 2 },
              '@media (prefers-reduced-motion: reduce)': { '&::after': { animation: 'none', opacity: 0 } },
            }}
          />
        ))}
        {/* Keyed by incident, so the card fades in afresh each time the active pin changes. */}
        {current && !compact && <IncidentCard key={current.id} incident={current} floating />}
      </Box>

      {current && compact && (
        <Box sx={{ mt: 1.5 }}>
          <IncidentCard key={current.id} incident={current} />
        </Box>
      )}

      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1.5, color: BP.muted, fontFamily: MONO_FONT, fontSize: 12, letterSpacing: '0.08em' }}
      >
        {types.map((t) => (
          <Stack key={t.value} direction="row" alignItems="center" spacing={0.75}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: TYPE_COLORS[t.value] }} />
            <span>{t.label.toUpperCase()}</span>
          </Stack>
        ))}
        <Box component="span" sx={{ ml: 'auto' }}>
          SAMPLE REPORTS
        </Box>
      </Stack>
    </Box>
  )
}
