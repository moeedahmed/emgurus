-- Add AI summaries for the demo blogs
INSERT INTO blog_ai_summaries (post_id, summary_md, model, provider, created_at)
SELECT 
  id,
  'Clinical summary: This comprehensive emergency medicine guide covers evidence-based protocols, advanced assessment techniques, and quality improvement metrics. Features systematic approaches to patient care with focus on rapid diagnosis, team-based interventions, and outcome optimization for ' || lower(substring(title from 'Blog \d+: (.*)')) || '.',
  'gpt-5-nano-2025-08-07',
  'openai',
  now()
FROM blog_posts
WHERE status = 'published';