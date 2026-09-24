import { ApiError, errorMessage } from './apiError'

describe('ApiError', () => {
  it('is an Error carrying the status, message and the backend-style error text', () => {
    const err = new ApiError(404, 'Report RPT-1 not found')
    expect(err).toBeInstanceOf(Error)
    expect(err).toMatchObject({
      name: 'ApiError',
      status: 404,
      error: 'Not Found',
      message: 'Report RPT-1 not found',
    })
  })

  it.each([
    [0, 'Network Error'],
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [409, 'Conflict'],
    [500, 'Internal Server Error'],
    [418, 'Error'],
    [501, 'Error'],
  ])('names status %p "%s"', (status, text) => {
    expect(new ApiError(status, 'x').error).toBe(text)
  })
})

describe('errorMessage', () => {
  it('uses the fallback when there is no error', () => {
    expect(errorMessage(null)).toBe('Something went wrong')
    expect(errorMessage(undefined, 'Could not load')).toBe('Could not load')
  })

  it('passes a string through', () => {
    expect(errorMessage('Plain text')).toBe('Plain text')
  })

  it("uses an error's message, or the fallback when it is empty", () => {
    expect(errorMessage(new ApiError(409, 'Busy'))).toBe('Busy')
    expect(errorMessage(new Error(''), 'Fallback')).toBe('Fallback')
    expect(errorMessage({})).toBe('Something went wrong')
  })
})
