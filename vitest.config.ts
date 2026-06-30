import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/utils/**', 'src/core/log.ts'],
      exclude: ['src/ui/**', 'src/core/drive.ts'],
    },
  },
});
