import { Selection } from '../services/betService';

export interface PendingLiveBet {
  pending_id: string;
  user_id: string;
  event_id: string;
  selections: Selection[];
  stake: number;
  accepted_odds: Record<string, number>; // eventId → quota accettata dall'utente
  created_at: number;                    // timestamp ms
  delay_ms: number;                      // delay generato (3000–5000)
  status: 'pending' | 'accepted' | 'rejected';
  rejection_reason?: 'odds_changed' | 'event_not_live' | 'market_locked' | 'stake_exceeded';
  new_odds?: Record<string, number>;     // quote aggiornate in caso di odds_changed
  codice_schedina?: string;              // valorizzato solo se accepted
}

export interface MarketLock {
  event_id: string;
  locked_at: number;
  lock_duration_ms: number;             // 5000–10000
  critical_event_type: 'goal' | 'penalty' | 'red_card' | 'score_change';
}

export interface ProtectionLogEntry {
  timestamp: string;
  pending_id: string;
  event_id: string;
  stake: number;
  accepted_odds: Record<string, number>;
  outcome: 'accepted' | 'rejected';
  rejection_reason?: string;
  odds_diff_pct?: number;               // percentuale di variazione quote
  lock_duration_ms?: number;
}

export interface ProtectionStats {
  period_hours: number;
  total_pending: number;
  total_accepted: number;
  total_rejected: number;
  rejections_by_reason: Record<string, number>;
}
