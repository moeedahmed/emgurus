-- Insert 10 demo blogs directly as published posts
DO $$
DECLARE
  admin_user_id uuid;
  categories_array uuid[] := ARRAY[
    (SELECT id FROM blog_categories WHERE title = 'General' LIMIT 1),
    (SELECT id FROM blog_categories WHERE title = 'Clinical Compendium' LIMIT 1),
    (SELECT id FROM blog_categories WHERE title = 'Exam Guidance' LIMIT 1),
    (SELECT id FROM blog_categories WHERE title = 'Careers' LIMIT 1),
    (SELECT id FROM blog_categories WHERE title = 'Research & Evidence' LIMIT 1)
  ];
  blog_ids uuid[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  titles text[] := ARRAY[
    'Advanced Cardiac Life Support: 2024 Guidelines Update',
    'Sepsis Recognition and Early Management in the ED',
    'Pediatric Emergency Medicine: Common Pitfalls and Solutions',
    'Trauma Surgery Decision Making: When to Operate',
    'Emergency Ultrasound: Point-of-Care Applications',
    'Mental Health Crisis Intervention in Emergency Settings',
    'Toxicology Emergencies: Rapid Assessment and Management',
    'Airway Management: Advanced Techniques and Troubleshooting',
    'Pain Management in Emergency Medicine: Multimodal Approaches',
    'Critical Care Transport: Stabilization and Transfer'
  ];
  slugs text[] := ARRAY[
    'acls-2024-guidelines-update',
    'sepsis-recognition-early-management',
    'pediatric-emergency-medicine-pitfalls', 
    'trauma-surgery-decision-making',
    'emergency-ultrasound-applications',
    'mental-health-crisis-intervention',
    'toxicology-emergencies-management',
    'airway-management-advanced-techniques',
    'pain-management-multimodal-approaches',
    'critical-care-transport-stabilization'
  ];
  descriptions text[] := ARRAY[
    'Comprehensive review of the latest ACLS guidelines with practical implementation strategies for emergency departments.',
    'Evidence-based approach to rapid sepsis identification and bundle compliance in emergency settings.',
    'Critical insights into pediatric emergency care with focus on age-specific assessment and intervention strategies.',
    'Strategic approach to trauma surgery decisions with emphasis on timing, resource allocation, and patient outcomes.',
    'Practical guide to bedside ultrasound techniques for rapid diagnosis and procedural guidance in emergency medicine.',
    'Comprehensive approach to psychiatric emergencies with focus on de-escalation, safety, and appropriate disposition.',
    'Evidence-based protocols for common poisonings with emphasis on rapid recognition and targeted therapy.',
    'Expert strategies for difficult airway scenarios with focus on backup plans and emergency surgical airways.',
    'Multimodal analgesia strategies for emergency pain management with consideration of safety and efficacy profiles.',
    'Best practices for patient stabilization and safe transport in critical care scenarios with inter-facility transfers.'
  ];
  now_ts timestamptz := now();
  i integer;
BEGIN
  -- Get admin user
  SELECT user_id INTO admin_user_id FROM profiles WHERE full_name ILIKE '%admin%' LIMIT 1;
  IF admin_user_id IS NULL THEN
    admin_user_id := 'cefb1a10-af1c-4c28-9fc0-46f91a804eea'; -- fallback
  END IF;

  -- Insert 10 demo blogs
  FOR i IN 1..10 LOOP
    INSERT INTO blog_posts (
      id, title, slug, description, content, cover_image_url,
      category_id, author_id, status, published_at, is_featured,
      view_count, likes_count, created_at, updated_at
    ) VALUES (
      blog_ids[i],
      titles[i],
      slugs[i], 
      descriptions[i],
      '# ' || titles[i] || '

## Clinical Overview

Understanding ' || lower(titles[i]) || ' requires a comprehensive approach to patient assessment and management. Evidence-based protocols guide our clinical decision-making process in modern emergency medicine practice.

**Key clinical indicators:**
- Patient presentation patterns and assessment criteria
- Diagnostic criteria and relevant biomarkers  
- Risk stratification protocols and scoring systems
- Treatment response monitoring and follow-up protocols

## <details><summary>📊 Evidence-Based Analysis (Click to expand)</summary>

Recent systematic reviews have demonstrated the effectiveness of standardized protocols in emergency medicine. Meta-analysis of 15 randomized controlled trials (n=4,832 patients) showed:

- 23% reduction in diagnostic errors when using structured assessment tools
- 18% improvement in patient satisfaction scores
- 15% decrease in length of stay for admitted patients
- Significant reduction in missed diagnoses (OR 0.72, 95% CI 0.58-0.89)

**Study limitations:** Heterogeneity in patient populations and outcome measures across studies. Further research needed in specific demographic groups.

</details>

![Clinical Assessment Chart](https://picsum.photos/seed/' || i || '/600/300 "Evidence-based clinical assessment flowchart")

## Management Protocols

### Acute Phase Management
1. **Initial Assessment (0-5 minutes)**
   - Vital signs stabilization
   - Primary survey completion
   - Critical interventions as needed

2. **Secondary Assessment (5-15 minutes)**
   - Detailed history and physical examination
   - Diagnostic testing coordination
   - Specialist consultation if indicated

3. **Disposition Planning (15-30 minutes)**
   - Treatment response evaluation
   - Discharge planning or admission coordination
   - Follow-up arrangements

## Conclusion

Modern emergency medicine requires integration of evidence-based protocols with clinical expertise. Continuous quality improvement and ongoing education ensure optimal patient outcomes in this rapidly evolving field.',
      'https://picsum.photos/seed/' || i || '/800/400',
      categories_array[((i-1) % 5) + 1],
      admin_user_id,
      'published',
      now_ts,
      CASE WHEN i <= 3 THEN true ELSE false END,
      floor(random() * 480 + 20)::int,
      floor(random() * 90 + 10)::int,
      now_ts - interval '1 day' * floor(random() * 30),
      now_ts
    );

    -- Insert AI summary for each blog
    INSERT INTO blog_ai_summaries (post_id, summary_md, model, provider, created_at)
    VALUES (
      blog_ids[i],
      'Clinical summary of ' || titles[i] || ': This comprehensive guide covers evidence-based approaches to ' || lower(titles[i]) || ', including diagnostic criteria, management protocols, and quality improvement metrics. Key focus areas include systematic assessment, team-based care, and outcome optimization.',
      'gpt-5-nano-2025-08-07',
      'openai',
      now_ts
    );

    -- Insert some engagement data
    INSERT INTO blog_shares (id, post_id, user_id, platform, created_at, shared_at)
    SELECT 
      gen_random_uuid(),
      blog_ids[i],
      admin_user_id,
      unnest(ARRAY['twitter', 'linkedin', 'facebook']),
      now_ts - interval '1 hour' * j,
      now_ts - interval '1 hour' * j
    FROM generate_series(1, floor(random() * 3 + 1)::int) j;

  END LOOP;

  RAISE NOTICE 'Successfully inserted 10 demo blogs with engagement data';
END $$;