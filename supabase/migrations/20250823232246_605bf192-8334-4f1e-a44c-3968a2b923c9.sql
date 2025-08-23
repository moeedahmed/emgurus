-- Insert 10 demo blogs with simple approach
WITH blog_data AS (
  SELECT 
    i,
    CASE i
      WHEN 1 THEN 'Cardiac Emergencies'
      WHEN 2 THEN 'Trauma Assessment'
      WHEN 3 THEN 'Pediatric Care'
      WHEN 4 THEN 'Toxicology Management'
      WHEN 5 THEN 'Respiratory Protocols'
      WHEN 6 THEN 'Neurological Emergencies'
      WHEN 7 THEN 'Pain Management'
      WHEN 8 THEN 'Infection Control'
      WHEN 9 THEN 'Mental Health Crisis'
      WHEN 10 THEN 'Emergency Surgery'
    END as topic
  FROM generate_series(1, 10) i
)
INSERT INTO blog_posts (
  id, title, slug, description, content, cover_image_url,
  category_id, author_id, status, published_at, is_featured,
  view_count, likes_count, created_at, updated_at
) 
SELECT 
  gen_random_uuid(),
  'Emergency Medicine Blog ' || i || ': ' || topic,
  'emergency-medicine-blog-' || i || '-' || lower(replace(topic, ' ', '-')),
  'Advanced clinical insights and evidence-based approaches for emergency medicine practitioners.',
  '# Emergency Medicine Blog ' || i || ': ' || topic || '

## Clinical Overview
This comprehensive guide covers advanced emergency medicine protocols with evidence-based approaches to patient care.

## <details><summary>📊 Clinical Evidence (Click to expand)</summary>
Recent studies show significant improvements in patient outcomes through systematic protocols.
</details>

![Medical Education](https://picsum.photos/800/400?random=' || i || ')

## <details><summary>🎥 Training Video (Click to expand)</summary>
<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Training" frameborder="0" allowfullscreen></iframe>
</details>

## <details><summary>🎧 Audio Resources (Click to expand)</summary>
<audio controls>
  <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" type="audio/mpeg">
</audio>
</details>

## Management Protocols
### Assessment Phase
- Primary survey completion
- Vital signs monitoring  
- Diagnostic coordination

### Intervention Phase
- Evidence-based treatment
- Team coordination
- Quality monitoring

## <details><summary>📋 Clinical Files (Click to expand)</summary>
📄 [Protocol Guidelines.pdf](https://example.com/protocol-' || i || '.pdf)
📄 [Reference Manual.pdf](https://example.com/manual-' || i || '.pdf)
</details>

## Conclusion
Systematic approaches improve patient outcomes through evidence-based medicine.',
  'https://picsum.photos/800/400?random=' || i,
  (SELECT id FROM blog_categories WHERE title = 'General' LIMIT 1),
  COALESCE((SELECT user_id FROM profiles WHERE full_name ILIKE '%admin%' LIMIT 1), 'cefb1a10-af1c-4c28-9fc0-46f91a804eea'),
  'published',
  now(),
  CASE WHEN i <= 3 THEN true ELSE false END,
  floor(random() * 400 + 50)::int,
  floor(random() * 80 + 10)::int,
  now() - interval '1 day' * floor(random() * 20),
  now()
FROM blog_data;