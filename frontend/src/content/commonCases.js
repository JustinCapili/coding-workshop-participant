/**
 * Reference links for the Common Cases page.
 *
 * Real content bundled with the app, not mock data: it is shown in every mode. There is no
 * backend or CMS for it yet (spec: "content source TBD"); when one exists, commonCasesService
 * fetches from it instead.
 */
export const commonCases = [
  { id: 'cc-1', title: 'Projector will not power on', category: 'IT', url: 'https://support.acme.example/kb/projector-no-power' },
  { id: 'cc-2', title: 'Wi-Fi drops in large rooms', category: 'IT', url: 'https://support.acme.example/kb/wifi-channel-overlap' },
  { id: 'cc-3', title: 'Resetting a badge reader', category: 'Safety', url: 'https://support.acme.example/kb/badge-reader-reset' },
  { id: 'cc-4', title: 'Reporting a water leak safely', category: 'Facilities', url: 'https://support.acme.example/kb/water-leak-first-response' },
  { id: 'cc-5', title: 'HVAC thermostat recalibration', category: 'Facilities', url: 'https://support.acme.example/kb/hvac-recalibration' },
  { id: 'cc-6', title: 'Printer duplex jams', category: 'IT', url: 'https://support.acme.example/kb/printer-duplex-jam' },
]
