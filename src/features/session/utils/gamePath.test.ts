import { describe, expect, test } from 'bun:test';

import type { GameValue } from '../../../types/game';
import { readGamePath } from './gamePath';

describe('readGamePath', () => {
  const value: GameValue = {
    player: {
      position: { x: 42, y: 73 },
      inventory: ['key', { id: 'orb' }],
    },
  };

  test('reads records and numeric array indices through the canonical dot path', () => {
    expect(readGamePath(value, 'player.position.x')).toBe(42);
    expect(readGamePath(value, 'player.inventory.0')).toBe('key');
    expect(readGamePath(value, 'player.inventory.1.id')).toBe('orb');
  });

  test('returns the current value for empty paths and undefined for missing paths', () => {
    expect(readGamePath(value)).toBe(value);
    expect(readGamePath(value, '')).toBe(value);
    expect(readGamePath(value, 'player.missing')).toBeUndefined();
    expect(readGamePath(value, 'player.inventory.invalid')).toBeUndefined();
  });
});
