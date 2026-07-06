# Supabase Migrations

Questa cartella contiene le migrazioni SQL per il database Supabase.

## Struttura

Le migrazioni sono numerate sequentialmente nel formato:
```
YYYYMMDDHHMMSS_nome_descrizione.sql
```

## Migrazioni Disponibili

### 20240415000001_create_balance_logs.sql
**Tabella: `balance_logs`**
- Traccia tutti i trasferimenti di credito tra reseller e utenti
- Campi principali: `reseller_id`, `user_id`, `amount`, `transfer_type`
- Include viste e funzioni per reportistica

### 20240415000002_create_skin_settings.sql
**Tabella: `skin_settings`**
- Configurazione temi/skin per la piattaforma
- Supporta multipli skin con colori personalizzabili
- Include skin di default "joverbet"

### 20240415000003_create_admin_logs.sql
**Tabella: `admin_logs`**
- Audit trail completo delle azioni amministrative
- Traccia modifiche utenti, scommesse, bilanci
- Include funzione helper `log_admin_action()`

## Come Applicare

### Opzione 1: Supabase CLI (Consigliato)

```bash
# Installa Supabase CLI se non l'hai già
npm install -g supabase

# Login
supabase login

# Link al tuo progetto
supabase link --project-ref <your-project-ref>

# Applica migrazioni
supabase db push
```

### Opzione 2: SQL Editor (Manuale)

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona il tuo progetto
3. Vai su "SQL Editor"
4. Copia e incolla il contenuto di ogni file `.sql`
5. Esegui in ordine numerico

### Opzione 3: psql

```bash
# Connetti al tuo database Supabase
psql postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Esegui migrazioni
\i 20240415000001_create_balance_logs.sql
\i 20240415000002_create_skin_settings.sql
\i 20240415000003_create_admin_logs.sql
```

## Verifica

Dopo l'applicazione, verifica che le tabelle siano state create:

```sql
-- Lista tabelle
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verifica balance_logs
SELECT COUNT(*) FROM balance_logs;

-- Verifica skin_settings
SELECT skin_name, is_active, is_default FROM skin_settings;

-- Verifica admin_logs
SELECT COUNT(*) FROM admin_logs;
```

## Rollback

⚠️ **Attenzione**: Non c'è un sistema automatico di rollback. Prima di applicare in produzione:

1. Fai un backup del database
2. Testa in ambiente di sviluppo
3. Applica durante orari di basso traffico

## Politiche RLS

Tutte le tabelle hanno Row Level Security (RLS) abilitato con le seguenti politiche:

- **balance_logs**: Reseller vedono solo i loro log, admin vedono tutto
- **skin_settings**: Solo superadmin possono modificare, tutti possono vedere i skin attivi
- **admin_logs**: Admin vedono i loro log e quelli degli utenti che gestiscono

## Funzioni Helper

### log_admin_action()
Registra un'azione amministrativa:
```sql
SELECT log_admin_action(
    auth.uid(),           -- admin_id
    'update_balance',     -- action
    'balance',            -- category
    'user',               -- target_type
    'user-uuid-here',     -- target_id
    '{"balance": 100}'::jsonb,    -- old_values
    '{"balance": 150}'::jsonb,    -- new_values
    'Added €50 credit',   -- description
    'success'             -- status
);
```

### get_reseller_daily_stats()
Ottiene statistiche giornaliere per reseller:
```sql
SELECT * FROM get_reseller_daily_stats(
    'reseller-uuid-here',
    '2024-04-15'::date
);
```

## Viste

### reseller_transfer_summary
Sommario trasferimenti per reseller e data:
```sql
SELECT * FROM reseller_transfer_summary 
WHERE reseller_id = 'uuid';
```

### admin_activity_summary
Sommario attività admin giornaliera:
```sql
SELECT * FROM admin_activity_summary 
WHERE activity_date = CURRENT_DATE;
```

## Troubleshooting

### Errore: "relation already exists"
Le migrazioni usano `IF NOT EXISTS`, quindi possono essere eseguite multiple volte senza errori.

### Errore: "permission denied"
Verifica di avere i permessi `postgres` o `supabase_admin` per eseguire le migrazioni.

### Errore: "policy already exists"
Se riesegui le migrazioni, le politiche RLS potrebbero già esistere. Questo è normale e non causa problemi.

## Supporto

Per problemi con le migrazioni:
1. Controlla i log di Supabase Dashboard
2. Verifica la sintassi SQL con `psql -f filename.sql --dry-run`
3. Apri una issue su GitHub con l'errore completo
