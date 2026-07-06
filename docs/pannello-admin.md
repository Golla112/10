# Pannello Admin — Guida completa

Accessibile da `/dashboard` con ruolo `admin` o `superadmin`.

---

## Tab: Dashboard

Mostra le metriche aggregate della piattaforma in tempo reale.

| Metrica | Significato |
|---|---|
| **Utenti Totali** | Numero di account registrati (user + reseller + admin) |
| **Saldo Sistema** | Somma di tutti i saldi degli utenti. Aumenta con le ricariche, diminuisce quando si pagano le vincite. |
| **Scommesse Pending** | Schedine ancora in attesa di risultato. Il profitto finale non è definitivo finché non sono tutte risolte. |
| **Profitto Book** | `Σ puntate incassate − Σ vincite pagate`. Positivo = il book guadagna. Negativo = il book ha pagato più di quanto incassato. |

### Come si calcola il Profitto Book

```
Profitto = puntate_totali_risolte - vincite_pagate
```

Esempio:
- Utenti hanno puntato €10.000 totali
- Di questi, €3.000 sono vincite pagate
- Profitto Book = **+€7.000**

Se invece gli utenti vincono €100.000 su €10.000 puntati → Profitto Book = **−€90.000**

> ⚠️ Le **prenotazioni** (schedine "Prenota") non scalano il saldo digitale — il pagamento avviene fisicamente al banco. Queste transazioni NON sono incluse nel Profitto Book digitale.

---

## Tab: Utenti

Gestione di tutti gli account della piattaforma.

- **Visualizza** saldo, stato (attivo/bloccato), data registrazione
- **Modifica saldo** manualmente (ricarica o detrazione)
- **Blocca/Sblocca** utenti
- **Cerca** per username

---

## Tab: Scommesse

Gestione completa di tutte le schedine.

### Filtri disponibili
- **Oggi / Settimana / Mese / Tutte / Custom** — filtra per periodo
- **⏳ 🏆 ❌ 🚫** — filtra per stato (pending, vinta, persa, annullata)
- **Cerca per username** — trova le schedine di un utente specifico

### Azioni su ogni schedina

| Azione | Quando disponibile | Effetto |
|---|---|---|
| **⚡ Settle** | Sempre | Interroga le API esterne per risolvere automaticamente |
| **🏆 Vinta** | Sempre | Imposta manualmente come vinta |
| **❌ Persa** | Sempre | Imposta manualmente come persa |
| **⏳ Pending** | Sempre | Riporta in attesa |
| **💰 Paga** | Solo se `result = win` e non ancora pagata | Accredita la vincita sul saldo dell'utente + stampa ricevuta |
| **🚫 Annulla** | Solo se `result = pending` | Annulla la schedina (non reversibile se già win/lose) |
| **🖨️ Stampa** | Sempre | Apre la ricevuta in formato termico |

### Settle Automatico
Il sistema risolve automaticamente le schedine pending ogni **30 minuti** usando tre fonti:
1. The Odds API
2. BetStack API
3. TheSportsDB

### Verifica Schedina
Inserisci il codice schedina per vedere immediatamente lo stato, le selezioni e i dettagli senza cercare nella lista.

---

## Tab: Rivenditori

Gestione dei reseller affiliati.

- Visualizza saldo e statistiche di ogni rivenditore
- Modifica il saldo del rivenditore
- Vedi gli utenti associati a ciascun reseller tramite codice affiliato

---

## Ruoli

| Ruolo | Accesso |
|---|---|
| `user` | Solo dashboard personale con le proprie scommesse |
| `reseller` | Pannello rivenditore (utenti + scommesse + statistiche) |
| `admin` | Pannello admin completo |
| `superadmin` | Pannello superadmin (gestione admin + rivenditori + saldi globali) |
