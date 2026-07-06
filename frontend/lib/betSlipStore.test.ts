import { useBetSlipStore } from './betSlipStore';
import type { Selection } from './betSlipStore';

const sel1: Selection = {
  event_id: 'evt1',
  nome_evento: 'Team A vs Team B',
  quota: 2.0,
  market: '1X2',
  outcome: '1',
};

const sel2: Selection = {
  event_id: 'evt2',
  nome_evento: 'Team C vs Team D',
  quota: 1.5,
  market: '1X2',
  outcome: 'X',
};

const sel3: Selection = {
  event_id: 'evt3',
  nome_evento: 'Team E vs Team F',
  quota: 3.0,
  market: 'over_under',
  outcome: 'over',
};

function getStore() {
  return useBetSlipStore.getState();
}

beforeEach(() => {
  useBetSlipStore.getState().clear();
});

describe('betSlipStore', () => {
  it('addSelection adds to selections array', () => {
    getStore().addSelection(sel1);
    expect(getStore().selections).toHaveLength(1);
    expect(getStore().selections[0]).toEqual(sel1);
  });

  it('addSelection replaces existing selection for same event', () => {
    getStore().addSelection(sel1);
    const updated = { ...sel1, quota: 2.5 };
    getStore().addSelection(updated);
    expect(getStore().selections).toHaveLength(1);
    expect(getStore().selections[0].quota).toBe(2.5);
  });

  it('removeSelection removes from selections array', () => {
    getStore().addSelection(sel1);
    getStore().addSelection(sel2);
    getStore().removeSelection('evt1');
    expect(getStore().selections).toHaveLength(1);
    expect(getStore().selections[0].event_id).toBe('evt2');
  });

  it('removeSelection on non-existent id leaves array unchanged', () => {
    getStore().addSelection(sel1);
    getStore().removeSelection('nonexistent');
    expect(getStore().selections).toHaveLength(1);
  });

  it('totalOdds is product of all quotas', () => {
    getStore().addSelection(sel1); // 2.0
    getStore().addSelection(sel2); // 1.5
    getStore().addSelection(sel3); // 3.0
    expect(getStore().totalOdds).toBeCloseTo(2.0 * 1.5 * 3.0);
  });

  it('totalOdds is 1 when selections are empty', () => {
    expect(getStore().totalOdds).toBe(1);
  });

  it('totalOdds equals single quota for one selection', () => {
    getStore().addSelection(sel1);
    expect(getStore().totalOdds).toBe(2.0);
  });

  it('potentialWin = stake * totalOdds', () => {
    getStore().addSelection(sel1); // quota 2.0
    getStore().addSelection(sel2); // quota 1.5 → totalOdds = 3.0
    getStore().setStake(10);
    expect(getStore().potentialWin).toBeCloseTo(30);
  });

  it('potentialWin updates when stake changes', () => {
    getStore().addSelection(sel1); // quota 2.0
    getStore().setStake(5);
    expect(getStore().potentialWin).toBeCloseTo(10);
    getStore().setStake(20);
    expect(getStore().potentialWin).toBeCloseTo(40);
  });

  it('potentialWin updates when selection is removed', () => {
    getStore().addSelection(sel1); // 2.0
    getStore().addSelection(sel2); // 1.5 → totalOdds = 3.0
    getStore().setStake(10);
    getStore().removeSelection('evt2'); // totalOdds = 2.0
    expect(getStore().potentialWin).toBeCloseTo(20);
  });

  it('clear() resets all state', () => {
    getStore().addSelection(sel1);
    getStore().setStake(50);
    getStore().setOwnerName('Mario');
    getStore().clear();
    const state = getStore();
    expect(state.selections).toHaveLength(0);
    expect(state.stake).toBe(0);
    expect(state.ownerName).toBe('');
    expect(state.totalOdds).toBe(1);
    expect(state.potentialWin).toBe(0);
  });

  it('setOwnerName updates owner name', () => {
    getStore().setOwnerName('Luigi');
    expect(getStore().ownerName).toBe('Luigi');
  });
});
