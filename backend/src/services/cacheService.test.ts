import { clampTTL, setEvents, setOdds } from './cacheService';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockSet = jest.fn().mockResolvedValue('OK');
  const mockGet = jest.fn().mockResolvedValue(null);
  const mockDel = jest.fn().mockResolvedValue(1);
  const MockRedis = jest.fn().mockImplementation(() => ({
    set: mockSet,
    get: mockGet,
    del: mockDel,
  }));
  (MockRedis as any).__mockSet = mockSet;
  return MockRedis;
});

import Redis from 'ioredis';

const mockSet = (Redis as any).__mockSet as jest.Mock;

beforeEach(() => {
  jest.resetModules();
  mockSet.mockClear();
  // Reset the singleton so each test gets a fresh client
  jest.isolateModules(() => {});
});

describe('clampTTL', () => {
  it('returns min when value is below min', () => {
    expect(clampTTL(100, 600, 1800)).toBe(600);
  });

  it('returns max when value is above max', () => {
    expect(clampTTL(9999, 600, 1800)).toBe(1800);
  });

  it('returns value unchanged when within range', () => {
    expect(clampTTL(900, 600, 1800)).toBe(900);
  });

  it('returns min when value equals min', () => {
    expect(clampTTL(600, 600, 1800)).toBe(600);
  });

  it('returns max when value equals max', () => {
    expect(clampTTL(1800, 600, 1800)).toBe(1800);
  });

  it('clamps odds TTL below min (300)', () => {
    expect(clampTTL(10, 300, 900)).toBe(300);
  });

  it('clamps odds TTL above max (900)', () => {
    expect(clampTTL(5000, 300, 900)).toBe(900);
  });

  it('passes odds TTL within range unchanged', () => {
    expect(clampTTL(600, 300, 900)).toBe(600);
  });
});

describe('setEvents TTL bounds', () => {
  it('clamps TTL to 600 when given a value below events min', () => {
    const ttl = clampTTL(1, 600, 1800);
    expect(ttl).toBeGreaterThanOrEqual(600);
    expect(ttl).toBeLessThanOrEqual(1800);
  });

  it('clamps TTL to 1800 when given a value above events max', () => {
    const ttl = clampTTL(99999, 600, 1800);
    expect(ttl).toBeGreaterThanOrEqual(600);
    expect(ttl).toBeLessThanOrEqual(1800);
  });

  it('keeps TTL within events bounds for any input', () => {
    const inputs = [0, 300, 599, 600, 900, 1200, 1800, 1801, 3600];
    for (const input of inputs) {
      const ttl = clampTTL(input, 600, 1800);
      expect(ttl).toBeGreaterThanOrEqual(600);
      expect(ttl).toBeLessThanOrEqual(1800);
    }
  });
});

describe('setOdds TTL bounds', () => {
  it('clamps TTL to 300 when given a value below odds min', () => {
    const ttl = clampTTL(1, 300, 900);
    expect(ttl).toBeGreaterThanOrEqual(300);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('clamps TTL to 900 when given a value above odds max', () => {
    const ttl = clampTTL(99999, 300, 900);
    expect(ttl).toBeGreaterThanOrEqual(300);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('keeps TTL within odds bounds for any input', () => {
    const inputs = [0, 100, 299, 300, 600, 900, 901, 1800];
    for (const input of inputs) {
      const ttl = clampTTL(input, 300, 900);
      expect(ttl).toBeGreaterThanOrEqual(300);
      expect(ttl).toBeLessThanOrEqual(900);
    }
  });
});
