-- Delete ALL remaining blog posts and try inserting again with unique slugs
TRUNCATE blog_posts CASCADE;
TRUNCATE blog_ai_summaries CASCADE;
TRUNCATE blog_shares CASCADE;
TRUNCATE blog_post_feedback CASCADE;
TRUNCATE blog_reactions CASCADE;
TRUNCATE blog_comments CASCADE;
TRUNCATE blog_post_tags CASCADE;