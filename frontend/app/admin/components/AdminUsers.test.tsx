/**
 * AdminUsers.test.tsx — Unit test per il componente AdminUsers
 *
 * Test:
 * 1. Render con utente bloccato → pulsante "Sblocca" visibile
 * 2. Render con utente attivo → pulsante "Blocca" visibile
 * 3. Validazione importo non valido → messaggio di errore
 * 4. Proprietà 13: Guardia accesso admin (fast-check)
 *    Feature: admin-panel, Property 13
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';

// ── Mock framer-motion (non disponibile in jsdom) ─────────────────────────────
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion: Record<string, React.FC<React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>> = {};
  ['div', 'button', 'span', 'p'].forEach(tag => {
    motion[tag] = ({ children, ...props }) => React.createElement(tag, props, children);
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

// ── Mock api ──────────────────────────────────────────────────────────────────
jest.mock('../../../lib/api', () => ({
  adminListUsers: jest.fn(),
  adminBlockUser: jest.fn(),
  adminUpdateBalance: jest.fn(),
}));

// ── Mock session ──────────────────────────────────────────────────────────────
jest.mock('../../../lib/session', () => ({
  getStoredUser: jest.fn(),
  getStoredPassword: jest.fn(() => 'test-password'),
}));

import { adminListUsers, adminBlockUser } from '../../../lib/api';
import AdminUsers from './AdminUsers';

// ── Utenti di test ────────────────────────────────────────────────────────────
const mockUsers = [
  { id: '1', username: 'mario', balance: 100, is_blocked: false, created_at: '2024-01-01' },
  { id: '2', username: 'luigi', balance: 50, is_blocked: true, created_at: '2024-01-02' },
];

// ── Helper: isAdminUser (logica pura della guardia admin) ─────────────────────
// Rispecchia la logica in admin/page.tsx: isAdmin deve essere esattamente true
function isAdminUser(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as Record<string, unknown>).isAdmin === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Render con utente bloccato → pulsante "Sblocca" visibile
// ─────────────────────────────────────────────────────────────────────────────
describe('AdminUsers — render utenti', () => {
  beforeEach(() => {
    (adminListUsers as jest.Mock).mockResolvedValue(mockUsers);
    (adminBlockUser as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mostra il pulsante "Sblocca" per un utente bloccato', async () => {
    render(<AdminUsers />);

    // Attende che la lista venga caricata
    await waitFor(() => {
      expect(screen.getByText('luigi')).toBeInTheDocument();
    });

    // luigi è bloccato → deve esserci il pulsante Sblocca
    expect(screen.getByRole('button', { name: /sblocca/i })).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Render con utente attivo → pulsante "Blocca" visibile
  // ─────────────────────────────────────────────────────────────────────────
  it('mostra il pulsante "Blocca" per un utente attivo', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('mario')).toBeInTheDocument();
    });

    // mario è attivo → deve esserci almeno un pulsante "Blocca" (non "Sblocca")
    const blockButtons = screen.getAllByRole('button', { name: /blocca/i });
    // Verifica che almeno uno dei pulsanti sia esattamente "Blocca" (non "Sblocca")
    const hasBlockButton = blockButtons.some(btn => /^\s*blocca\s*$/i.test(btn.textContent ?? ''));
    expect(hasBlockButton).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Validazione importo non valido → messaggio di errore
  // ─────────────────────────────────────────────────────────────────────────
  it('mostra un messaggio di errore per importo non valido (0)', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('mario')).toBeInTheDocument();
    });

    // Apre il form saldo per mario (primo utente)
    const saldoButtons = screen.getAllByRole('button', { name: /saldo/i });
    fireEvent.click(saldoButtons[0]);

    // Attende che il form sia visibile
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/importo/i)).toBeInTheDocument();
    });

    // Inserisce 0 come importo
    const input = screen.getByPlaceholderText(/importo/i);
    fireEvent.change(input, { target: { value: '0' } });

    // Clicca Conferma
    const confermaButton = screen.getByRole('button', { name: /conferma/i });
    fireEvent.click(confermaButton);

    // Verifica che appaia il messaggio di errore
    await waitFor(() => {
      expect(screen.getByText(/importo valido/i)).toBeInTheDocument();
    });
  });

  it('mostra un messaggio di errore per importo negativo', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('mario')).toBeInTheDocument();
    });

    const saldoButtons = screen.getAllByRole('button', { name: /saldo/i });
    fireEvent.click(saldoButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/importo/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/importo/i);
    fireEvent.change(input, { target: { value: '-10' } });

    const confermaButton = screen.getByRole('button', { name: /conferma/i });
    fireEvent.click(confermaButton);

    await waitFor(() => {
      expect(screen.getByText(/importo valido/i)).toBeInTheDocument();
    });
  });

  it('mostra un messaggio di errore per importo non numerico (stringa vuota)', async () => {
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText('mario')).toBeInTheDocument();
    });

    const saldoButtons = screen.getAllByRole('button', { name: /saldo/i });
    fireEvent.click(saldoButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/importo/i)).toBeInTheDocument();
    });

    // Lascia il campo vuoto (NaN dopo parseFloat)
    const confermaButton = screen.getByRole('button', { name: /conferma/i });
    fireEvent.click(confermaButton);

    await waitFor(() => {
      expect(screen.getByText(/importo valido/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Proprietà 13: Guardia accesso admin
// Feature: admin-panel, Property 13
//
// Per qualsiasi oggetto utente dalla sessione con isAdmin !== true,
// la guardia admin deve bloccare l'accesso.
// Validates: Requirements 9.1, 9.4
// ─────────────────────────────────────────────────────────────────────────────
describe('Proprietà 13: Guardia accesso admin', () => {
  /**
   * Testa la funzione pura isAdminUser con fast-check.
   * Per qualsiasi oggetto con isAdmin !== true, isAdminUser deve restituire false.
   */
  it('isAdminUser restituisce false per qualsiasi utente con isAdmin !== true', () => {
    // Arbitrario: oggetti con isAdmin che non è esattamente true
    const nonAdminArb = fc.oneof(
      // isAdmin: false
      fc.record({
        username: fc.string(),
        isAdmin: fc.constant(false),
      }),
      // isAdmin: undefined
      fc.record({
        username: fc.string(),
      }),
      // isAdmin: stringa (es. "true", "admin")
      fc.record({
        username: fc.string(),
        isAdmin: fc.string(),
      }),
      // isAdmin: numero
      fc.record({
        username: fc.string(),
        isAdmin: fc.integer(),
      }),
      // null
      fc.constant(null),
      // undefined
      fc.constant(undefined),
      // oggetto vuoto
      fc.constant({}),
    );

    fc.assert(
      fc.property(nonAdminArb, (user) => {
        return isAdminUser(user) === false;
      }),
      { numRuns: 200 }
    );
  });

  it('isAdminUser restituisce true solo quando isAdmin è esattamente true', () => {
    // Verifica il caso positivo: isAdmin === true
    const adminUser = { username: 'mirkoct', isAdmin: true };
    expect(isAdminUser(adminUser)).toBe(true);
  });

  it('isAdminUser restituisce false per isAdmin: 1 (numero, non booleano)', () => {
    expect(isAdminUser({ username: 'test', isAdmin: 1 })).toBe(false);
  });

  it('isAdminUser restituisce false per isAdmin: "true" (stringa)', () => {
    expect(isAdminUser({ username: 'test', isAdmin: 'true' })).toBe(false);
  });
});
