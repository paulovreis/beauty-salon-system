module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/setupEnv.js'],
  roots: ['<rootDir>/tests'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
  ],
  transform: {},
};