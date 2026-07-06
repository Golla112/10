-- Migration: Create skin_settings table for theme management
-- Created: 2024-04-15

-- Table for storing skin/theme configurations
CREATE TABLE IF NOT EXISTS skin_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Skin identification
    skin_name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    
    -- Colors (stored as hex values)
    color_primary VARCHAR(7) DEFAULT '#262626',
    color_secondary VARCHAR(7) DEFAULT '#14805e',
    color_background VARCHAR(7) DEFAULT '#0d0d0d',
    color_surface VARCHAR(7) DEFAULT '#1a1a1a',
    color_accent VARCHAR(7) DEFAULT '#00b4d8',
    color_text VARCHAR(7) DEFAULT '#d4e2f0',
    color_text_muted VARCHAR(7) DEFAULT '#5e7a96',
    color_success VARCHAR(7) DEFAULT '#14805e',
    color_warning VARCHAR(7) DEFAULT '#f59e0b',
    color_error VARCHAR(7) DEFAULT '#ef4444',
    
    -- Logo and assets
    logo_url TEXT,
    favicon_url TEXT,
    
    -- Configuration JSON for additional settings
    config JSONB DEFAULT '{}',
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Ensure only one default skin
CREATE UNIQUE INDEX idx_skin_settings_single_default 
ON skin_settings(is_default) 
WHERE is_default = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skin_settings_active ON skin_settings(is_active);

-- Row Level Security
ALTER TABLE skin_settings ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage skin settings
CREATE POLICY "Only superadmins can manage skins" 
    ON skin_settings 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'superadmin'
        )
    );

-- Everyone can view active skins
CREATE POLICY "Everyone can view active skins" 
    ON skin_settings 
    FOR SELECT 
    USING (is_active = true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_skin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_skin_settings_updated_at
    BEFORE UPDATE ON skin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_skin_settings_updated_at();

-- Insert default skin
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
    color_text_muted,
    color_success,
    color_warning,
    color_error,
    logo_url,
    config
) VALUES (
    'joverbet',
    true,
    true,
    '#262626',
    '#14805e',
    '#0d0d0d',
    '#1a1a1a',
    '#00b4d8',
    '#d4e2f0',
    '#5e7a96',
    '#14805e',
    '#f59e0b',
    '#ef4444',
    '/logo.png',
    '{"headerVersion": "version1", "chatEnabled": true, "toggleDesktop": true}'::jsonb
) ON CONFLICT (skin_name) DO NOTHING;

COMMENT ON TABLE skin_settings IS 'Stores theme/skin configurations for the betting platform';
