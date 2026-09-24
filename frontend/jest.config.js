/**
 * Unit and component tests: Jest + React Testing Library in jsdom. `npm test` runs this with
 * coverage, and the threshold below fails the run under 80%.
 *
 * Babel options are inline (configFile: false) so no project-level Babel file exists for Vite's
 * React plugin to pick up; the build is unaffected by the test setup. transform-vite-meta-env
 * rewrites `import.meta.env.X` to `process.env.X`, which Jest can run: services/config.js and
 * services/http.js read their settings that way.
 *
 * The end-to-end suite has its own config, jest.e2e.config.js.
 */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/src/test/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.js'],
  transform: {
    '^.+\\.jsx?$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        plugins: ['babel-plugin-transform-vite-meta-env'],
      },
    ],
  },
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/test/styleStub.js',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/main.jsx', '!src/test/**'],
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
}
