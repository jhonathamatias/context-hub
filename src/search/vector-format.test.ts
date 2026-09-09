import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cosineDistanceToScore, toVectorLiteral } from './vector-format';

describe('toVectorLiteral', () => {
  it('formats floats for pgvector', () => {
    assert.equal(toVectorLiteral([0.1, -0.25, 1]), '[0.1,-0.25,1]');
  });

  it('rejects empty vectors', () => {
    assert.throws(() => toVectorLiteral([]), /empty embedding vector/);
  });

  it('rejects non-finite values', () => {
    assert.throws(() => toVectorLiteral([1, Number.NaN]), /non-finite/);
  });
});

describe('cosineDistanceToScore', () => {
  it('maps identical vectors to score 1', () => {
    assert.equal(cosineDistanceToScore(0), 1);
  });

  it('decreases as distance grows', () => {
    assert.ok(cosineDistanceToScore(0.2) < cosineDistanceToScore(0.1));
  });
});
