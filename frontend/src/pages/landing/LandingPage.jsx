import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import EditNoteIcon from '@mui/icons-material/EditNote'
import EngineeringIcon from '@mui/icons-material/Engineering'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { COMPANY_DOMAIN } from '../../domain/accounts'
import { ReportStatus, STATUS_LABELS } from '../../domain/reportStatus'
import BlueprintMap from './BlueprintMap'
import { BP, DISPLAY_FONT, MONO_FONT, gridBackground } from './blueprint'

const REGISTER = '/login?mode=register'

/** Who moves a report into each stage, as ReportService enforces it. */
const STAGES = [
  [ReportStatus.UNASSIGNED, 'Anyone files it, with a type, a priority and where it is.'],
  [ReportStatus.ASSIGNED, 'A faculty admin puts engineers on it, or approves an engineer’s request.'],
  [ReportStatus.IN_PROGRESS, 'An assigned engineer starts the work.'],
  [ReportStatus.SUBMITTED, 'The engineer submits the fix for review.'],
  [ReportStatus.APPROVED, 'The admin signs it off, or sends it back for more work.'],
  [ReportStatus.ARCHIVED, 'Closed, and kept for the next person with the same problem.'],
]

const ROLES = [
  {
    name: 'Employee',
    tag: 'FILES & FOLLOWS',
    icon: EditNoteIcon,
    does: [
      'File a report from any room in a few clicks',
      'Follow every step in the report’s activity thread',
      'Ask for it to be closed once it is fixed',
    ],
  },
  {
    name: 'Engineer',
    tag: 'TAKES & FIXES',
    icon: EngineeringIcon,
    does: [
      'Ask to take on reports nobody is working yet',
      'Start, work and submit fixes for review',
      'Look up previous reports and common cases',
    ],
  },
  {
    name: 'Faculty Admin',
    tag: 'ASSIGNS & APPROVES',
    icon: AdminPanelSettingsIcon,
    does: [
      'Put engineers on reports and approve their requests',
      'Sign off fixes and closures',
      'See the team’s open cases at a glance',
    ],
  },
]

/** A drawing-style section callout, e.g. "DETAIL 1 — LIFECYCLE". */
function Callout({ children, color = BP.brand }) {
  return (
    <Typography
      component="p"
      sx={{ fontFamily: MONO_FONT, fontSize: 12, letterSpacing: '0.18em', color, mb: 1.5 }}
    >
      {children}
    </Typography>
  )
}

function SectionHeading({ id, children, sx }) {
  return (
    <Typography
      id={id}
      component="h2"
      sx={{
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        fontSize: { xs: '2rem', md: '2.75rem' },
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}

function TopBar() {
  return (
    <Box component="header" sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, color: BP.ink }}>
      <Container maxWidth="lg" sx={{ py: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
            <ReportProblemIcon sx={{ color: BP.accent }} />
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: 16, sm: 18 } }} noWrap>
              ACME Incident Reports
            </Typography>
          </Stack>
          <Button component={RouterLink} to="/login" sx={{ color: BP.ink }}>
            Sign in
          </Button>
          <Button
            component={RouterLink}
            to={REGISTER}
            variant="contained"
            color="secondary"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Create account
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}

function Hero() {
  return (
    <Box
      component="section"
      aria-labelledby="landing-heading"
      sx={{
        ...gridBackground(),
        color: BP.ink,
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 12, md: 16 },
        pb: { xs: 8, md: 12 },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 60% 55% at 72% 38%, rgba(31, 78, 121, 0.75), transparent 70%)`,
        }}
      />
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Grid container spacing={{ xs: 6, md: 8 }} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Callout color={BP.muted}>ACME INC. · FACILITIES · IT · SAFETY</Callout>
            <Typography
              id="landing-heading"
              component="h1"
              sx={{
                fontFamily: DISPLAY_FONT,
                fontWeight: 700,
                // Sized so "See something?" holds one line in the column at every breakpoint.
                fontSize: { xs: '2.6rem', sm: '3.2rem', md: '3.1rem', lg: '3.9rem' },
                lineHeight: 1.02,
                letterSpacing: '-0.03em',
              }}
            >
              See something?{' '}
              <Box component="span" sx={{ display: 'block', color: BP.accent }}>
                Say something.
              </Box>
            </Typography>
            <Typography sx={{ mt: 3, color: BP.muted, fontSize: { xs: 17, md: 19 }, lineHeight: 1.55, maxWidth: 460 }}>
              A projector that won’t start, a wet floor, an alarm in the server room: pin it to a
              report in a few clicks, and follow it until it’s resolved.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              <Button
                component={RouterLink}
                to={REGISTER}
                variant="contained"
                color="secondary"
                size="large"
                endIcon={<ArrowForwardIcon />}
              >
                Create your account
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="large"
                sx={{ color: BP.ink, borderColor: BP.lineMajor, '&:hover': { borderColor: BP.ink } }}
              >
                Sign in
              </Button>
            </Stack>
            <Typography sx={{ mt: 2, color: BP.muted, fontSize: 14 }}>
              Accounts use your{' '}
              <Box component="span" sx={{ fontFamily: MONO_FONT, color: BP.ink }}>
                @{COMPANY_DOMAIN}
              </Box>{' '}
              email.
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <BlueprintMap />
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

function Lifecycle() {
  const tick = { content: '""', position: 'absolute', bgcolor: BP.brand }
  return (
    <Box
      component="section"
      aria-labelledby="lifecycle-heading"
      sx={{
        ...gridBackground({ base: BP.paper, minor: BP.paperLine, major: 'rgba(31, 78, 121, 0.12)' }),
        py: { xs: 8, md: 12 },
      }}
    >
      <Container maxWidth="lg">
        <Callout>DETAIL 1 — LIFECYCLE</Callout>
        <SectionHeading id="lifecycle-heading">From pin to resolved</SectionHeading>
        <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 560, fontSize: 17 }}>
          Every report moves through the same six stages, and every move lands in its activity
          thread, so nobody has to ask where things stand.
        </Typography>
        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            mt: 6,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
            rowGap: { xs: 0, sm: 4, md: 0 },
          }}
        >
          {STAGES.map(([status, caption], i) => (
            <Box
              component="li"
              key={status}
              sx={{
                position: 'relative',
                pl: { xs: 3, md: 0 },
                pr: { md: 2.5 },
                pt: { md: 3 },
                pb: { xs: 3, md: 0 },
                borderLeft: { xs: `2px solid ${BP.brand}`, md: 'none' },
                borderTop: { md: `2px solid ${BP.brand}` },
                '&::before': {
                  ...tick,
                  left: { xs: -8, md: 0 },
                  top: { xs: 0, md: -8 },
                  width: { xs: 14, md: 2 },
                  height: { xs: 2, md: 14 },
                },
                '&:last-of-type::after': {
                  ...tick,
                  display: { xs: 'none', md: 'block' },
                  right: 0,
                  top: -8,
                  width: 2,
                  height: 14,
                },
              }}
            >
              <Typography sx={{ fontFamily: MONO_FONT, fontSize: 13, color: 'secondary.main', letterSpacing: '0.1em' }}>
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography component="h3" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 20, mt: 0.5 }}>
                {STATUS_LABELS[status]}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>
                {caption}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

function Roles() {
  const corner = { content: '""', position: 'absolute', width: 14, height: 14, borderColor: BP.brand, borderStyle: 'solid' }
  return (
    <Box component="section" aria-labelledby="roles-heading" sx={{ bgcolor: 'background.paper', py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Callout>DETAIL 2 — ROLES</Callout>
        <SectionHeading id="roles-heading">One tool, three roles</SectionHeading>
        <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 560, fontSize: 17 }}>
          Everyone signs in at the same door. What they see next depends on who they are.
        </Typography>
        <Grid container spacing={3} sx={{ mt: 5 }}>
          {ROLES.map(({ name, tag, icon: Icon, does }) => (
            <Grid key={name} size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  position: 'relative',
                  height: '100%',
                  p: 3.5,
                  bgcolor: BP.paper,
                  border: '1px solid rgba(31, 78, 121, 0.18)',
                  '&::before': { ...corner, top: -1, left: -1, borderWidth: '2px 0 0 2px' },
                  '&::after': { ...corner, bottom: -1, right: -1, borderWidth: '0 2px 2px 0' },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    bgcolor: BP.brand,
                    color: '#fff',
                  }}
                >
                  <Icon />
                </Box>
                <Typography component="h3" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 24, mt: 2.5 }}>
                  {name}
                </Typography>
                <Typography sx={{ fontFamily: MONO_FONT, fontSize: 12, letterSpacing: '0.14em', color: 'text.secondary' }}>
                  {tag}
                </Typography>
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2.5 }}>
                  {does.map((line) => (
                    <Box
                      component="li"
                      key={line}
                      sx={{
                        position: 'relative',
                        pl: 2.5,
                        py: 0.75,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: '0.85em',
                          width: 8,
                          height: 8,
                          bgcolor: 'secondary.main',
                        },
                      }}
                    >
                      <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                        {line}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

function ClosingCall() {
  return (
    <Box component="section" aria-labelledby="closing-heading" sx={{ ...gridBackground(), color: BP.ink, py: { xs: 8, md: 11 } }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <SectionHeading id="closing-heading">Ready when something breaks.</SectionHeading>
        <Typography sx={{ mt: 2, color: BP.muted, fontSize: 17 }}>
          Create an account with your @{COMPANY_DOMAIN} email, or sign in if you already have one.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 4 }}>
          <Button component={RouterLink} to={REGISTER} variant="contained" color="secondary" size="large">
            Create an account
          </Button>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            size="large"
            sx={{ color: BP.ink, borderColor: BP.lineMajor, '&:hover': { borderColor: BP.ink } }}
          >
            Sign in
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}

/**
 * `/` for visitors who are not signed in (HomeRoute sends everyone else to their dashboard): what
 * the app is for, how a report moves, who does what, and the way in. Drawn as a blueprint of the
 * campus, with sample incidents pinned to it.
 */
export default function LandingPage() {
  const year = new Date().getFullYear()
  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: BP.paper }}>
      <TopBar />
      <Box component="main">
        <Hero />
        <Lifecycle />
        <Roles />
        <ClosingCall />
      </Box>
      <Box component="footer" sx={{ bgcolor: BP.navyDeep, color: BP.muted, py: 3 }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Typography variant="body2">© {year} ACME Inc. · For internal use</Typography>
            <Typography variant="body2" sx={{ fontFamily: MONO_FONT, letterSpacing: '0.12em' }}>
              INCIDENT REPORTS · SHEET 1 OF 1
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
