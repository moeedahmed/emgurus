-- Insert 10 fresh demo blogs with unique slugs
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
  now_ts timestamptz := now();
  i integer;
  blog_id uuid;
  cat_id uuid;
BEGIN
  -- Get admin user
  SELECT user_id INTO admin_user_id FROM profiles WHERE full_name ILIKE '%admin%' LIMIT 1;
  IF admin_user_id IS NULL THEN
    admin_user_id := 'cefb1a10-af1c-4c28-9fc0-46f91a804eea'; -- fallback
  END IF;

  -- Insert 10 demo blogs with unique slugs
  FOR i IN 1..10 LOOP
    blog_id := gen_random_uuid();
    cat_id := categories_array[((i-1) % 5) + 1];
    
    INSERT INTO blog_posts (
      id, title, slug, description, content, cover_image_url,
      category_id, author_id, status, published_at, is_featured,
      view_count, likes_count, created_at, updated_at
    ) VALUES (
      blog_id,
      'Demo Medical Blog ' || i || ': Emergency Medicine Insights',
      'demo-medical-blog-' || i || '-emergency-medicine-insights',
      'Advanced clinical insights and evidence-based approaches for emergency medicine practitioners, featuring case studies and protocols.',
      '# Demo Medical Blog ' || i || ': Emergency Medicine Insights

## Clinical Overview

This comprehensive guide covers advanced emergency medicine protocols with evidence-based approaches to patient care. Our systematic methodology ensures optimal outcomes in critical scenarios.

**Key Clinical Focus Areas:**
- Rapid assessment protocols
- Evidence-based decision making
- Advanced intervention techniques
- Quality improvement metrics

## <details><summary>📊 Clinical Evidence (Click to expand)</summary>

Recent meta-analysis demonstrates significant improvements in patient outcomes:

- 25% reduction in diagnostic errors
- 20% improvement in patient satisfaction 
- 18% decrease in length of stay
- Enhanced safety protocols implementation

**Research Methodology:** Multi-center randomized controlled trials (n=5,240 patients) across emergency departments.

</details>

![Medical Education](https://picsum.photos/seed/' || i || '/600/300 "Clinical assessment protocols")

## <details><summary>🎥 Educational Resources (Click to expand)</summary>

**Advanced Emergency Medicine Training**

<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Educational Video" frameborder="0" allowfullscreen></iframe>

Comprehensive training modules covering:
- Emergency assessment techniques
- Clinical decision-making processes
- Advanced life support protocols

</details>

## <details><summary>🎧 Podcast Series (Click to expand)</summary>

**Emergency Medicine Insights Podcast**

<audio controls>
  <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>

Expert discussions featuring:
- Leading emergency physicians
- Case study reviews
- Latest research findings

Duration: 45 minutes

</details>

## Management Protocols

### Phase 1: Initial Assessment (0-5 minutes)
1. **Primary Survey**
   - Airway assessment and management
   - Breathing evaluation and support
   - Circulation assessment and intervention
   - Disability evaluation (neurological)
   - Exposure and environmental control

### Phase 2: Secondary Assessment (5-15 minutes)
1. **Detailed Evaluation**
   - Comprehensive history taking
   - Physical examination
   - Diagnostic studies coordination
   - Specialist consultation as needed

### Phase 3: Disposition and Follow-up (15+ minutes)
1. **Treatment Response**
   - Intervention effectiveness evaluation
   - Discharge planning or admission
   - Follow-up care coordination

## <details><summary>📋 Clinical Resources (Click to expand)</summary>

**Essential Reference Materials:**

📄 [Emergency Medicine Guidelines.pdf](https://example.com/guidelines-' || i || '.pdf)

📄 [Quick Reference Protocols.pdf](https://example.com/protocols-' || i || '.pdf)

📱 [Medical Calculator App.apk](https://example.com/calculator-' || i || '.apk)

**Additional Tools:**
- Evidence-based decision trees
- Risk assessment calculators
- Drug interaction checkers
- Patient education materials

</details>

## Quality Metrics & Outcomes

Performance indicators following protocol implementation:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to diagnosis | 42 min | 28 min | 33% ↓ |
| Patient satisfaction | 7.5/10 | 8.9/10 | 19% ↑ |
| Readmission rate | 11.2% | 7.8% | 30% ↓ |
| Cost efficiency | $2,600 | $2,200 | 15% ↓ |

## Conclusion

Modern emergency medicine integrates evidence-based protocols with clinical expertise. Continuous quality improvement and systematic approaches ensure optimal patient outcomes in rapidly evolving clinical environments.

**Key Takeaways:**
- Systematic protocols improve accuracy
- Team-based approaches enhance safety
- Regular updates reflect current evidence
- Quality metrics guide improvement efforts

---

*Last updated: ' || to_char(now(), 'YYYY-MM-DD') || ' | Next review: ' || to_char(now() + interval '6 months', 'YYYY-MM-DD') || '*',
      'https://picsum.photos/seed/' || i || '/800/400',
      cat_id,
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
      blog_id,
      'Clinical summary: This comprehensive emergency medicine guide covers evidence-based protocols, advanced assessment techniques, and quality improvement metrics. Features systematic approaches to patient care with focus on rapid diagnosis, team-based interventions, and outcome optimization.',
      'gpt-5-nano-2025-08-07',
      'openai',
      now_ts
    );

    -- Insert engagement data (shares)
    INSERT INTO blog_shares (id, post_id, user_id, platform, created_at, shared_at)
    SELECT 
      gen_random_uuid(),
      blog_id,
      admin_user_id,
      platform,
      now_ts - interval '1 hour' * j,
      now_ts - interval '1 hour' * j
    FROM unnest(ARRAY['twitter', 'linkedin', 'facebook']) AS platform,
         generate_series(1, floor(random() * 2 + 1)::int) j;

  END LOOP;

  RAISE NOTICE 'Successfully inserted 10 demo blogs with AI summaries and engagement data';
END $$;