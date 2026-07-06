# Pannello SuperAdmin — Guida completa

Accessibile da `/dashboard` con ruolo `superadmin`.

Il superadmin ha visibilità e controllo totale sulla piattaforma, inclusi admin e rivenditori.

---

## Sezioni disponibili

### Utenti (tutti i ruoli)
Visualizza e gestisce **tutti** gli account: `user`, `reseller`, `admin`, `superadmin`.

- Badge colorati per ruolo:
  - 🔵 `user`
  - 🟡 `reseller`
  - 🔴 `admin`
  - 🟣 `superadmin`
- **Modifica saldo** — può aggiustare il saldo di qualsiasi account, inclusi admin e reseller
- **Blocca/Sblocca** qualsiasi utente

> ⚠️ Il saldo non può andare sotto zero. Il sistema blocca l'operazione se il nuovo saldo risulterebbe negativo.

---

### Rivenditori
Panoramica di tutti i reseller con le loro statistiche aggregate.

---

### Profitti Globali
Visione d'insieme dei profitti dell'intera piattaforma per periodo (giornaliero, settimanale, mensile, annuale).

---

## Logica dei profitti — visione globale

```
Profitto Piattaforma = Σ tutte_le_puntate_risolte − Σ tutte_le_vincite_pagate
```

### Esempio pratico

| Evento | Importo | Effetto sul profitto |
|---|---|---|
| Utente punta €100 (Scommetti) | −€100 dal saldo utente | Puntata incassata +€100 |
| Utente perde | — | Profitto +€100 (definitivo) |
| Utente vince €350 | +€350 sul saldo utente (al pagamento) | Profitto −€350 |
| **Netto** | | **−€250** (il book ha perso) |

### Prenotazioni fisiche
Le schedine "Prenota" non scalano il saldo digitale. Il pagamento avviene fisicamente al banco. Queste transazioni **non sono tracciate** nel profitto digitale della piattaforma.

---

## Settle automatico

Il sistema risolve le schedine pending automaticamente ogni **30 minuti** usando:
1. **The Odds API** — fonte primaria
2. **BetStack API** — fonte secondaria
3. **TheSportsDB** — fonte terziaria di fallback

Il settle confronta l'esito della partita con le selezioni della schedina e aggiorna il risultato (`win` / `lose`). Il pagamento fisico rimane sempre manuale (bottone "💰 Paga").

---

## Bonus multipla — impatto sul profitto

Il sistema applica automaticamente un bonus sulle vincite delle multiple:

| Selezioni | Bonus | Effetto sul profitto |
|---|---|---|
| 2+ eventi | +5% sulla vincita | Riduce il margine del book del 5% |
| 4+ eventi | +10% sulla vincita | Riduce il margine del book del 10% |
| 6+ eventi | +20% sulla vincita | Riduce il margine del book del 20% |

Il bonus viene calcolato su `puntata × quota_totale` e aggiunto alla vincita potenziale. Aumenta l'attrattività per i giocatori ma riduce il margine del book sulle multiple.
