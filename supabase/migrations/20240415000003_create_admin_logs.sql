-- Migration: Create admin_logs table for audit trail
-- Created: 2024-04-15

-- Table for tracking all administrative actions
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Who performed the action
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_role VARCHAR(50) NOT NULL CHECK (admin_role IN ('admin', 'superadmin', 'reseller')),
    admin_username VARCHAR(255),
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL CHECK (action_category IN ('user', 'bet', 'balance', 'system', 'auth', 'config')),
    
    -- Target of the action (if applicable)
    target_type VARCHAR(50) CHECK (target_type IN ('user', 'bet', 'system', 'config')),
    target_id UUID,
    target_username VARCHAR(255),
    
    -- Before/After values for changes
    old_values JSONB,
    new_values JSONB,
    
    -- Additional context
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_category ON admin_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_created ON admin_logs(admin_id, created_at DESC);

-- Row Level Security
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view their own logs and logs of users they manage
CREATE POLICY "Admins can view relevant logs" 
    ON admin_logs 
    FOR SELECT 
    USING (
        auth.uid() = admin_id 
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- System can insert logs
CREATE POLICY "System can insert admin logs" 
    ON admin_logs 
    FOR INSERT 
    WITH CHECK (true);

-- Only superadmins can delete logs (for GDPR compliance)
CREATE POLICY "Only superadmins can delete logs" 
    ON admin_logs 
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'superadmin'
        )
    );

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action VARCHAR,
    p_category VARCHAR,
    p_target_type VARCHAR DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_status VARCHAR DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_admin_role VARCHAR;
    v_admin_username VARCHAR;
    v_target_username VARCHAR;
    v_log_id UUID;
BEGIN
    -- Get admin info
    SELECT role, username INTO v_admin_role, v_admin_username
    FROM users WHERE id = p_admin_id;
    
    -- Get target username if applicable
    IF p_target_type = 'user' AND p_target_id IS NOT NULL THEN
        SELECT username INTO v_target_username
        FROM users WHERE id = p_target_id;
    END IF;
    
    -- Insert log
    INSERT INTO admin_logs (
        admin_id,
        admin_role,
        admin_username,
        action,
        action_category,
        target_type,
        target_id,
        target_username,
        old_values,
        new_values,
        description,
        status,
        error_message
    ) VALUES (
        p_admin_id,
        v_admin_role,
        v_admin_username,
        p_action,
        p_category,
        p_target_type,
        p_target_id,
        v_target_username,
        p_old_values,
        p_new_values,
        p_description,
        p_status,
        p_error_message
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent admin activity
CREATE OR REPLACE FUNCTION get_recent_admin_activity(
    p_limit INTEGER DEFAULT 50,
    p_category VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    admin_username VARCHAR,
    admin_role VARCHAR,
    action VARCHAR,
    action_category VARCHAR,
    target_username VARCHAR,
    description TEXT,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.admin_username,
        al.admin_role,
        al.action,
        al.action_category,
        al.target_username,
        al.description,
        al.status,
        al.created_at
    FROM admin_logs al
    WHERE (p_category IS NULL OR al.action_category = p_category)
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for common admin actions summary
CREATE OR REPLACE VIEW admin_activity_summary AS
SELECT 
    admin_id,
    admin_username,
    admin_role,
    DATE(created_at) as activity_date,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_actions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_actions,
    COUNT(DISTINCT action_category) as categories_used
FROM admin_logs
GROUP BY admin_id, admin_username, admin_role, DATE(created_at);

COMMENT ON TABLE admin_logs IS 'Audit trail for all administrative actions on the platform';
COMMENT ON FUNCTION log_admin_action IS 'Helper function to log admin actions with automatic user info lookup';
