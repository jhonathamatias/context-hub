import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('preserves order and respects concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return n * 10;
    });

    assert.deepEqual(results, [10, 20, 30, 40, 50]);
    assert.ok(maxInFlight <= 2);
  });
});
