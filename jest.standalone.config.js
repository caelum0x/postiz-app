// Minimal, self-contained Jest config for the pure-logic unit tests added
// alongside the bulk-schedule and provider-capability work. The repo's
// top-level `pnpm test` goes through `@nx/jest`'s `getJestProjects()`,
// which isn't wired up in this workspace (no nx.json, no per-project jest
// configs), so it can't discover anything. This config targets only the
// `*.standalone.spec.ts` files next to the code they cover and runs with
// plain ts-jest, independent of that broken wiring.
//
// Run with: pnpm exec jest --config jest.standalone.config.js
module.exports = {
  displayName: 'standalone',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/**/*.standalone.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          skipLibCheck: true,
          strict: false,
          jsx: 'react-jsx',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/frontend/(.*)$': '<rootDir>/apps/frontend/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/nestjs-libraries/(.*)$':
      '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/react/(.*)$': '<rootDir>/libraries/react-shared-libraries/src/$1',
    '^@gitroom/plugins/(.*)$': '<rootDir>/libraries/plugins/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
    '^@gitroom/extension/(.*)$': '<rootDir>/apps/extension/src/$1',
  },
};
