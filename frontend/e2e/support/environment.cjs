/**
 * Jest's Node environment, plus one thing Jest does not offer: knowing in afterEach whether the
 * test just failed, so the spec can save a screenshot and the page source (see artifacts.js).
 *
 * jest-circus reports test_fn_failure before it runs the afterEach hooks, so the flag is set by
 * the time they look. CommonJS because Jest loads test environments with require.
 */
const { TestEnvironment } = require('jest-environment-node')

class E2EEnvironment extends TestEnvironment {
  async handleTestEvent(event) {
    if (event.name === 'test_start') {
      this.global.__E2E_TEST_FAILED__ = false
    }
    if (event.name === 'test_fn_failure' || event.name === 'hook_failure') {
      this.global.__E2E_TEST_FAILED__ = true
    }
  }
}

module.exports = E2EEnvironment
