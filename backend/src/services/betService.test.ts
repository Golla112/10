import { generateCodiceSchedina, computeTotalOdds, computePotentialWin } from './betService';

describe('betService', () => {
  describe('generateCodiceSchedina', () => {
    it('starts with "BB"', () => {
      const code = generateCodiceSchedina();
      expect(code.startsWith('BB')).toBe(true);
    });

    it('returns different values on consecutive calls', () => {
      const codes = new Set(Array.from({ length: 10 }, () => generateCodiceSchedina()));
      // All 10 should be unique
      expect(codes.size).toBe(10);
    });
  });

  describe('computeTotalOdds', () => {
    it('returns 1 for empty selections', () => {
      expect(computeTotalOdds([])).toBe(1);
    });

    it('returns the single quota for one selection', () => {
      expect(computeTotalOdds([{ quota: 2.5 }])).toBe(2.5);
    });

    it('multiplies all quotas correctly', () => {
      const selections = [{ quota: 2.0 }, { quota: 1.5 }, { quota: 3.0 }];
      expect(computeTotalOdds(selections)).toBeCloseTo(9.0, 5);
    });

    it('handles fractional quotas', () => {
      const selections = [{ quota: 1.25 }, { quota: 4.0 }];
      expect(computeTotalOdds(selections)).toBeCloseTo(5.0, 5);
    });
  });

  describe('computePotentialWin', () => {
    it('computes stake * totalOdds rounded to 2 decimals', () => {
      expect(computePotentialWin(10, 2.5, [{ quota: 2.5 }])).toBe(25.0);
    });

    it('rounds to 2 decimal places', () => {
      // 10 * 1.333... = 13.33...
      expect(computePotentialWin(10, 1.333, [{ quota: 1.333 }])).toBe(13.33);
    });

    it('handles zero stake', () => {
      expect(computePotentialWin(0, 3.0, [{ quota: 3.0 }])).toBe(0);
    });

    it('handles large values correctly', () => {
      expect(computePotentialWin(100, 10.5, [{ quota: 10.5 }])).toBe(1050.0);
    });
  });
});
