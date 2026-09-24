/**
 * End-to-end tests: Selenium drives a headless Firefox through the running app, against the real
 * local stack (Vite → proxy → Spring Boot Lambda on LocalStack → Postgres). `npm run test:e2e`.
 *
 * Needs the local stack up (./bin/start-dev.sh); e2e/support/globalSetup.js checks that first and
 * says what is missing. Specs run one at a time: they share one backend, and each drives a real
 * browser.
 */
export default {
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/*.e2e.test.js'],
  testEnvironment: '<rootDir>/e2e/support/environment.cjs',
  globalSetup: '<rootDir>/e2e/support/globalSetup.js',
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
      },
    ],
  },
  // A cold Lambda start plus a browser per spec: minutes, not seconds.
  testTimeout: 180000,
  maxWorkers: 1,
}
