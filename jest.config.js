module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/src/**/__tests__/**/*.test.js',
    '**/src/**/__tests__/**/*.test.jsx',
    '**/src/**/*.test.js',
    '**/src/**/*.test.jsx',
  ],
  collectCoverageFrom: [
    'src/services/**/*.{js,jsx}',
    'src/hooks/**/*.{js,jsx}',
    'src/context/**/*.{js,jsx}',
    'src/lib/**/*.{js,jsx}',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 20,
      functions: 18,
      branches: 15,
      statements: 20,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo-google-fonts/.*|react-navigation|@sentry/react-native|native-base|react-native-svg))',
  ],
};
