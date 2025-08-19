-- Insert missing exam types into taxonomy_terms
INSERT INTO taxonomy_terms (slug, title, kind) VALUES
  ('mrcem-primary', 'MRCEM Primary', 'exam'),
  ('mrcem-sba', 'MRCEM SBA', 'exam'),
  ('frcem-sba', 'FRCEM SBA', 'exam'),
  ('fcps-part1', 'FCPS Part 1', 'exam'),
  ('fcps-part1-pk', 'FCPS Part 1 (Pakistan)', 'exam'),
  ('fcps-part2', 'FCPS Part 2', 'exam'),
  ('fcps-part2-pk', 'FCPS Part 2 (Pakistan)', 'exam'),
  ('fcps-imm', 'FCPS IMM', 'exam'),
  ('fcps-imm-pk', 'FCPS IMM (Pakistan)', 'exam')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind;

-- Update curriculum_map to use proper exam types instead of OTHER
UPDATE curriculum_map 
SET exam_type = 'FCPS_IMM'::exam_type_enum 
WHERE exam_type = 'OTHER'::exam_type_enum;

-- Insert sample curriculum data for testing
INSERT INTO curriculum_map (exam_type, key_capability_number, key_capability_title, slo_number, slo_title) VALUES
  ('MRCEM_PRIMARY', 1, 'Clinical Knowledge', 1, 'Basic Sciences'),
  ('MRCEM_PRIMARY', 1, 'Clinical Knowledge', 2, 'Pathophysiology'),
  ('MRCEM_SBA', 1, 'Emergency Management', 1, 'Acute Medical Emergencies'),
  ('MRCEM_SBA', 1, 'Emergency Management', 2, 'Trauma Management'),
  ('FRCEM_SBA', 1, 'Advanced Emergency Medicine', 1, 'Critical Care'),
  ('FRCEM_SBA', 1, 'Advanced Emergency Medicine', 2, 'Complex Procedures'),
  ('FCPS_PART1', 1, 'Basic Medical Sciences', 1, 'Anatomy'),
  ('FCPS_PART1', 1, 'Basic Medical Sciences', 2, 'Physiology'),
  ('FCPS_PART2', 1, 'Clinical Medicine', 1, 'Internal Medicine'),
  ('FCPS_PART2', 1, 'Clinical Medicine', 2, 'Surgery'),
  ('FCPS_IMM', 1, 'Emergency Medicine', 1, 'Emergency Assessment'),
  ('FCPS_IMM', 1, 'Emergency Medicine', 2, 'Emergency Procedures')
ON CONFLICT DO NOTHING;