// Pro Sports API Types - Interfacce complete per API professionale

export interface TeamColors {
  primary: string;
  secondary: string;
}

export interface TeamRanking {
  position: number;
  points: number;
}

export interface Season {
  id: string;
  name: string;
  year: string;
  start: string;
  end: string;
  current: boolean;
}

export interface TournamentFormat {
  type: 'league' | 'cup' | 'tournament';
  teams: number;
  rounds?: number;
  groups?: number;
}

export interface Standing {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface OddsMovement {
  time: number;
  oldPrice: number;
  newPrice: number;
  direction: 'up' | 'down';
}

export interface SuspendedMarket {
  marketId: string;
  reason: string;
  suspendedAt: number;
}

export interface PriceMovement {
  time: number;
  change: number;
  percentage: number;
}

// Extend WebSocket interface
declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
  }
}
