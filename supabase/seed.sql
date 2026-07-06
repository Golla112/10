-- Seed data for development/testing
-- Run this after migrations to populate tables with sample data

-- ============================================
-- SEED: Skin Settings
-- ============================================

INSERT INTO skin_settings (
    skin_name, 
    is_active, 
    is_default,
    color_primary,
    color_secondary,
    color_background,
    color_surface,
    color_accent,
    color_text,
    config
) VALUES 
(
    'ocean',
    false,
    false,
    '#1e3a5f',
    '#0ea5e9',
    '#0f172a',
    '#1e293b',
    '#22d3ee',
    '#e0f2fe',
    '{"headerVersion": "version2", "chatEnabled": true}'::jsonb
),
(
    'royal',
    false,
    false,
    '#4c1d95',
    '#a855f7',
    '#2e1065',
    '#4c1d95',
    '#d8b4fe',
    '#f3e8ff',
    '{"headerVersion": "version1", "chatEnabled": false}'::jsonb
)
ON CONFLICT (skin_name) DO NOTHING;

-- ============================================
-- SEED: Admin Logs (sample audit trail)
-- ============================================

-- These will be created by actual admin actions, but here's the structure:
COMMENT ON TABLE admin_logs IS 'Audit trail - populated automatically by backend functions';

-- ============================================
-- SEED: Balance Logs (sample transfers)
-- ============================================

-- These should be created by actual reseller actions
-- The table structure supports:
-- - Positive amounts: Credit TO user (reseller -> user)
-- - Negative amounts: Debit FROM user (user -> reseller)

COMMENT ON TABLE balance_logs IS 'Transfer logs - populated automatically by reseller actions';

-- ============================================
-- HELPER: Create test data function
-- ============================================

CREATE OR REPLACE FUNCTION seed_test_data()
RETURNS void AS $$
BEGIN
    -- This function can be extended to create test data
    -- Use with caution in production!
    
    RAISE NOTICE 'Seed data function created. Call seed_test_data() to populate test data.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_test_data() IS 'Helper function to populate test data for development';

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify tables were created
DO $$
DECLARE
    v_balance_logs_exists BOOLEAN;
    v_skin_settings_exists BOOLEAN;
    v_admin_logs_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'balance_logs'
    ) INTO v_balance_logs_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'skin_settings'
    ) INTO v_skin_settings_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_logs'
    ) INTO v_admin_logs_exists;
    
    RAISE NOTICE 'Migration Status:';
    RAISE NOTICE '- balance_logs: %', CASE WHEN v_balance_logs_exists THEN '✓ Created' ELSE '✗ Missing' END;
    RAISE NOTICE '- skin_settings: %', CASE WHEN v_skin_settings_exists THEN '✓ Created' ELSE '✗ Missing' END;
    RAISE NOTICE '- admin_logs: %', CASE WHEN v_admin_logs_exists THEN '✓ Created' ELSE '✗ Missing' END;
END;
$$;
