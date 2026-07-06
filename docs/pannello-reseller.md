# Pannello Rivenditore — Guida completa

Accessibile da `/dashboard` con ruolo `reseller`.

---

## Come funziona il modello rivenditore

Il rivenditore è un intermediario tra la piattaforma e gli utenti finali. Ogni rivenditore ha:
- Un **codice affiliato** univoco da condividere con i propri utenti
- Un **saldo proprio** che riflette i profitti/perdite generati dai suoi utenti
- Una lista di **utenti associati** (quelli che si sono registrati con il suo codice)

### Flusso del profitto

```
Utente punta €100  →  saldo utente -€100
Utente perde       →  profitto reseller +€100 (il saldo del reseller aumenta)
Utente vince €300  →  profitto reseller -€300 (il saldo del reseller diminuisce)
```

Il profitto del reseller è quindi:
```
Profitto = Σ puntate_perse_dai_tuoi_utenti − Σ vincite_pagate_ai_tuoi_utenti
```

---

## Tab: Statistiche

| Metrica | Significato |
|---|---|
| **Saldo corrente** | Il tuo saldo disponibile come rivenditore |
| **Profitto da utenti** | Differenza tra puntate incassate e vincite pagate dei tuoi utenti. Verde = guadagno, Rosso = perdita |
| **Totale utenti** | Numero di utenti registrati con il tuo codice affiliato |
| **Utenti attivi** | Utenti che hanno piazzato almeno una scommessa |
| **Scommesse in corso** | Schedine pending dei tuoi utenti — il profitto finale si aggiorna dopo il settle |

### Codice Affiliato
Il tuo codice affiliato è mostrato in cima alla sezione statistiche. Condividilo con i tuoi clienti: quando si registrano inserendo questo codice, vengono associati al tuo account e le loro scommesse contribuiscono al tuo profitto.

---

## Tab: Utenti

Lista di tutti gli utenti associati al tuo codice affiliato.

- **Visualizza** saldo e stato di ogni utente
- **Ricarica saldo** — aggiungi credito a un utente (il costo viene scalato dal tuo saldo)
- **Blocca/Sblocca** utenti
- **Cerca** per username

> ⚠️ Quando ricarichi un utente, il tuo saldo diminuisce dello stesso importo. Esempio: ricarichi €50 a Mario → il tuo saldo scende di €50, il saldo di Mario sale di €50.

---

## Tab: Scommesse

Lista di tutte le schedine dei tuoi utenti.

- Filtra per periodo (oggi, settimana, mese, custom)
- Filtra per stato (pending, vinta, persa, annullata)
- **💰 Paga** — disponibile solo per schedine `win` non ancora pagate. Accredita la vincita all'utente e stampa la ricevuta di pagamento.
- **🖨️ Stampa** — ricevuta in formato termico 80mm

---

## Scommesse: Prenota vs Scommetti

| Tipo | Saldo scalato? | Tracciato nel profitto? |
|---|---|---|
| **Scommetti** | Sì, subito | Sì |
| **Prenota** | No (pagamento fisico al banco) | No |

Le prenotazioni non influenzano il saldo digitale né il profitto del reseller. Sono solo un promemoria per il pagamento fisico.
