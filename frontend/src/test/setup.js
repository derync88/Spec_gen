// Extends Vitest's `expect` with @testing-library/jest-dom matchers
// (toBeInTheDocument, toHaveClass, …) and cleans the DOM between tests.
// Cleanup is registered manually because we run Vitest without globals.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
