/**
 * Unit tests for BetHistoryTable component
 * Verifies result color coding: green for win, red for lose, neutral for pending
 * Feature: bigbet365-sportsbook, Property 10: Result color mapping is consistent
 * Validates: Requirements 6.5, 6.6, 6.7
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BetHistoryTable from './BetHistoryTable';
import { Bet } from '../lib/api';

const makeBet = (overrides: Partial<Bet> = {}): Bet => ({
  id: 'bet-1',
  codice_schedina: 'BB1ABCD',
  nome_proprietario: 'Mario',
  stake: 10,
  selections: [],
  total_odds: 2.5,
  potential_win: 25,
  result: 'pending',
  created_at: '2024-01-15T10:00:00Z',
  settled_at: null,
  paid_at: null,
  ...overrides,
});

describe('BetHistoryTable', () => {
  it('shows empty state when no bets', () => {
    render(<BetHistoryTable bets={[]} />);
    expect(screen.getByText(/nessuna scommessa/i)).toBeInTheDocument();
  });

  it('win result shows green styling', () => {
    render(<BetHistoryTable bets={[makeBet({ result: 'win' })]} />);
    const badge = screen.getByText(/Vinto/);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/green/);
    expect(badge.className).toMatch(/result-win/);
  });

  it('lose result shows red styling', () => {
    render(<BetHistoryTable bets={[makeBet({ result: 'lose' })]} />);
    const badge = screen.getByText(/Perso/);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/red/);
    expect(badge.className).toMatch(/result-lose/);
  });

  it('pending result shows neutral (gray) styling', () => {
    render(<BetHistoryTable bets={[makeBet({ result: 'pending' })]} />);
    const badge = screen.getByText(/Attesa/);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/gray/);
    expect(badge.className).toMatch(/result-pending/);
  });

  it('renders bet data correctly', () => {
    const bet = makeBet({ codice_schedina: 'BB1TEST', nome_proprietario: 'Luigi', stake: 20, potential_win: 50 });
    render(<BetHistoryTable bets={[bet]} />);
    expect(screen.getByText('BB1TEST')).toBeInTheDocument();
    expect(screen.getByText('€20.00')).toBeInTheDocument();
    expect(screen.getByText('€50.00')).toBeInTheDocument();
  });

  it('clicking date header toggles sort direction', async () => {
    const user = userEvent.setup();
    const bets = [
      makeBet({ id: '1', created_at: '2024-01-10T10:00:00Z', codice_schedina: 'BB1AAA' }),
      makeBet({ id: '2', created_at: '2024-01-20T10:00:00Z', codice_schedina: 'BB1BBB' }),
    ];
    render(<BetHistoryTable bets={bets} />);
    const dateHeader = screen.getByText(/data/i);
    // Default is desc (newest first)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('BB1BBB');
    // Click to asc
    await user.click(dateHeader);
    const rowsAsc = screen.getAllByRole('row');
    expect(rowsAsc[1]).toHaveTextContent('BB1AAA');
  });
});
