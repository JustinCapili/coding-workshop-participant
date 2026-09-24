/**
 * The incidents pinned to the landing page's floor plan. Illustrative only: the page is shown to
 * visitors who are not signed in, and the API answers nobody without a token. The values are real
 * enum values, so the chips render exactly as they do inside the app.
 *
 * `x` and `y` place the pin as a percentage of the plan's width and height (see BlueprintMap).
 */
export const CAMPUS_INCIDENTS = Object.freeze([
  {
    id: 'RPT-2044',
    room: 'Server room',
    type: 'IT',
    priority: 'CRITICAL',
    status: 'UNASSIGNED',
    title: 'Rack 4 overheating alarm',
    ago: 'just now',
    x: 66,
    y: 22,
  },
  {
    id: 'RPT-2043',
    room: 'Hall B',
    type: 'SAFETY',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'Wet floor by the east stairs',
    ago: '3 min ago',
    x: 83,
    y: 50,
  },
  {
    id: 'RPT-2041',
    room: 'Room 204',
    type: 'IT',
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    title: 'Projector will not power on',
    ago: '12 min ago',
    x: 40,
    y: 17,
  },
  {
    id: 'RPT-2038',
    room: 'Lab 3',
    type: 'FACILITIES',
    priority: 'LOW',
    status: 'SUBMITTED',
    title: 'Fume hood light flickering',
    ago: '1 h ago',
    x: 16,
    y: 30,
  },
  {
    id: 'RPT-2031',
    room: 'Atrium',
    type: 'FACILITIES',
    priority: 'MEDIUM',
    status: 'APPROVED',
    title: 'Automatic door sticks halfway',
    ago: 'yesterday',
    x: 32,
    y: 80,
  },
])
