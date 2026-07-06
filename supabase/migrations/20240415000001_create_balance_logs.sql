-- Migration: Create balance_logs table for reseller credit transfers
-- Created: 2024-04-15

-- Table for tracking all balance transfers between resellers and their users
CREATE TABLE IF NOT EXISTS balance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Reseller who initiated the transfer
    reseller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User who received/gave the credit
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Transfer amount (positive = credit to user, negative = debit from user)
    amount DECIMAL(12, 2) NOT NULL,
    
    -- User's balance after the transfer
    user_balance_after DECIMAL(12, 2) NOT NULL,
    
    -- Optional note/reason for the transfer
    note TEXT,
    
    -- Transfer type for categorization
    transfer_type VARCHAR(50) DEFAULT 'manual' CHECK (transfer_type IN ('manual', 'auto', 'correction', 'bonus')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_balance_logs_reseller_id ON balance_logs(reseller_id);
CREATE INDEX IF NOT EXISTS idx_balance_logs_user_id ON balance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_logs_created_at ON balance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_logs_reseller_created ON balance_logs(reseller_id, created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE balance_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Resellers can see their own transfer logs
CREATE POLICY "Resellers can view their own balance logs" 
    ON balance_logs 
    FOR SELECT 
    USING (auth.uid() = reseller_id);

-- Policy: Admins and superadmins can view all logs
CREATE POLICY "Admins can view all balance logs" 
    ON balance_logs 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Policy: System can insert logs (for backend operations)
CREATE POLICY "System can insert balance logs" 
    ON balance_logs 
    FOR INSERT 
    WITH CHECK (true);

-- View for reseller summary statistics
CREATE OR REPLACE VIEW reseller_transfer_summary AS
SELECT 
    reseller_id,
    DATE(created_at) as transfer_date,
    COUNT(*) as total_transfers,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credited,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debited,
    SUM(amount) as net_transfer
FROM balance_logs
GROUP BY reseller_id, DATE(created_at);

-- Function to get reseller daily stats
CREATE OR REPLACE FUNCTION get_reseller_daily_stats(p_reseller_id UUID, p_date DATE)
RETURNS TABLE (
    total_transfers BIGINT,
    total_credited DECIMAL,
    total_debited DECIMAL,
    unique_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::DECIMAL,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::DECIMAL,
        COUNT(DISTINCT user_id)::BIGINT
    FROM balance_logs
    WHERE reseller_id = p_reseller_id
    AND DATE(created_at) = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to validate transfers (prevent if reseller has insufficient balance for credit)
CREATE OR REPLACE FUNCTION validate_reseller_transfer()
RETURNS TRIGGER AS $$
DECLARE
    v_reseller_balance DECIMAL;
BEGIN
    -- Only validate positive transfers (crediting user)
    IF NEW.amount > 0 THEN
        -- Get reseller's current balance
        SELECT balance INTO v_reseller_balance
        FROM users
        WHERE id = NEW.reseller_id AND role = 'reseller';
        
        -- Check if reseller has enough balance
        IF v_reseller_balance IS NULL OR v_reseller_balance < NEW.amount THEN
            RAISE EXCEPTION 'Insufficient reseller balance for transfer. Available: %, Requested: %', 
                COALESCE(v_reseller_balance, 0), NEW.amount;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation (optional - can be enabled if needed)
-- CREATE TRIGGER trg_validate_reseller_transfer
--     BEFORE INSERT ON balance_logs
--     FOR EACH ROW
--     EXECUTE FUNCTION validate_reseller_transfer();

COMMENT ON TABLE balance_logs IS 'Tracks all credit/debit transfers between resellers and their managed users';
COMMENT ON COLUMN balance_logs.amount IS 'Positive for credit to user, negative for debit from user';
COMMENT ON COLUMN balance_logs.transfer_type IS 'Type of transfer: manual, auto, correction, bonus';
