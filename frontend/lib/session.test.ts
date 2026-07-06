import { isAuthenticated, setAuthenticated, clearSession, storeUser, getStoredUser } from './session';
import type { UserSession } from './session';

describe('session helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isAuthenticated returns false when localStorage is empty', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when user is stored', () => {
    const user: UserSession = { username: 'mario', isAdmin: false, role: 'user' };
    storeUser(user);
    expect(isAuthenticated()).toBe(true);
  });

  it('storeUser persists user and getStoredUser retrieves it', () => {
    const user: UserSession = { username: 'luigi', isAdmin: false, role: 'user' };
    storeUser(user);
    const retrieved = getStoredUser();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.username).toBe('luigi');
  });

  it('clearSession removes the user from localStorage', () => {
    const user: UserSession = { username: 'mario', isAdmin: false, role: 'user' };
    storeUser(user);
    expect(isAuthenticated()).toBe(true);
    clearSession();
    expect(isAuthenticated()).toBe(false);
    expect(getStoredUser()).toBeNull();
  });

  it('setAuthenticated is a no-op (Supabase manages auth)', () => {
    // setAuthenticated is kept for compatibility but does nothing
    setAuthenticated();
    expect(isAuthenticated()).toBe(false);
  });
});
