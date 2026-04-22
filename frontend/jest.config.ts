import type { Config } from 'jest';

const config: Config = {
  // Ambiente de browser simulado (DOM)
  testEnvironment: 'jsdom',

  // Polyfills executados antes do ambiente de teste
  setupFiles: ['<rootDir>/jest.polyfills.ts'],

  // Arquivo de setup executado após o framework Jest estar pronto
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Compilação TypeScript via ts-jest (usa tsconfig.app.json que tem os paths @/)
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: '<rootDir>/tsconfig.app.json',
        diagnostics: {
          ignoreCodes: ['TS151001'],
        },
      },
    ],
  },

  // Alias @/ → src/ (igual ao tsconfig/vite)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // CSS: proxy que devolve o nome da classe como string
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Imagens e fontes: mock simples
    '\\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot)$':
      '<rootDir>/src/__mocks__/fileMock.ts',
  },

  // Quais extensões de arquivo o Jest resolve
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  transformIgnorePatterns: ['node_modules'],

  // Padrão de busca de arquivos de teste
  testMatch: [
    '**/__tests__/**/*.(ts|tsx)',
    '**/?(*.)+(spec|test).(ts|tsx)',
  ],

  // Arquivos incluídos na cobertura
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/__mocks__/**',
    '!src/mocks/**',
  ],

  // Thresholds mínimos de cobertura — aumentar conforme novos testes forem adicionados
  coverageThreshold: {
    global: {
      branches: 3,
      functions: 4,
      lines: 8,
      statements: 8,
    },
  },

  // Evita noise no output
  verbose: true,
};

export default config;
