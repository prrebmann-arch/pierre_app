-- Coach-level overrides for bloodtest marker zones (clinical bands).
-- Format: { [marker_key]: ZoneConfig | { sex_specific: { male?: ZoneConfig, female?: ZoneConfig } } }
-- Empty {} = no overrides, all defaults from catalog used.

ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS bloodtest_zone_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN coach_profiles.bloodtest_zone_overrides IS
  'Per-coach overrides for catalog marker zones. Keys are marker_key from MARKERS catalog. Values match ZoneConfig or {sex_specific:...} shape from lib/bloodtestCatalog.ts. Custom markers store their zones in coach_custom_markers, NOT here.';
