import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderApp'
import BlueprintMap, { CYCLE_MS } from './BlueprintMap'
import { CAMPUS_INCIDENTS } from './campusIncidents'

const pins = () => screen.getAllByRole('button')
const plan = () => pins()[0].parentElement
const card = () => document.getElementById('blueprint-incident-card')
const showing = () => card().querySelector('p.MuiTypography-subtitle2').textContent
const wait = (ms) => act(() => jest.advanceTimersByTime(ms))

/** Answers `matches` for whichever media queries `matching` picks out. */
function mockMatchMedia(matching) {
  window.matchMedia = jest.fn((query) => ({
    matches: matching(query),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
}

beforeEach(() => jest.useFakeTimers())

afterEach(() => {
  jest.useRealTimers()
  delete window.matchMedia
})

describe('BlueprintMap', () => {
  it('names every pin in words, so colour is never the only clue', () => {
    renderWithProviders(<BlueprintMap />)

    expect(pins().map((pin) => pin.getAttribute('aria-label'))).toEqual([
      'IT incident in Server room: Rack 4 overheating alarm, critical priority, unassigned',
      'Safety incident in Hall B: Wet floor by the east stairs, high priority, in progress',
      'IT incident in Room 204: Projector will not power on, medium priority, assigned',
      'Facilities incident in Lab 3: Fume hood light flickering, low priority, submitted',
      'Facilities incident in Atrium: Automatic door sticks halfway, medium priority, approved',
    ])
  })

  it('shows the first report, then moves on to the next every few seconds, and around again', () => {
    renderWithProviders(<BlueprintMap />)
    expect(showing()).toBe(CAMPUS_INCIDENTS[0].title)

    wait(CYCLE_MS)
    expect(showing()).toBe(CAMPUS_INCIDENTS[1].title)

    wait(CYCLE_MS * (CAMPUS_INCIDENTS.length - 1))
    expect(showing()).toBe(CAMPUS_INCIDENTS[0].title)
  })

  it('shows the pin under the pointer and holds it there until the pointer leaves the plan', () => {
    renderWithProviders(<BlueprintMap />)

    fireEvent.mouseEnter(pins()[2])
    expect(showing()).toBe(CAMPUS_INCIDENTS[2].title)
    wait(CYCLE_MS * 3)
    expect(showing()).toBe(CAMPUS_INCIDENTS[2].title)

    fireEvent.mouseLeave(plan())
    wait(CYCLE_MS)
    expect(showing()).toBe(CAMPUS_INCIDENTS[3].title)
  })

  it('shows the focused pin and holds it while focus stays on the plan', () => {
    renderWithProviders(<BlueprintMap />)

    act(() => pins()[4].focus())
    wait(CYCLE_MS * 3)
    expect(showing()).toBe(CAMPUS_INCIDENTS[4].title)
    expect(pins()[4]).toHaveAttribute('aria-describedby', 'blueprint-incident-card')
    expect(pins()[0]).not.toHaveAttribute('aria-describedby')
  })

  it('never moves on by itself when the visitor prefers reduced motion', () => {
    mockMatchMedia((query) => query.includes('prefers-reduced-motion'))
    renderWithProviders(<BlueprintMap />)

    wait(CYCLE_MS * 3)
    expect(showing()).toBe(CAMPUS_INCIDENTS[0].title)
  })

  it('puts the card under the plan on a phone-sized screen, and over it otherwise', () => {
    mockMatchMedia((query) => query.includes('max-width'))
    const { unmount } = renderWithProviders(<BlueprintMap />)
    expect(plan()).not.toContainElement(card())
    unmount()

    delete window.matchMedia
    renderWithProviders(<BlueprintMap />)
    expect(plan()).toContainElement(card())
  })
})
