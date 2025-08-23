-- Clean up legacy blogs and seed fresh demo blogs
-- This will delete all existing blogs and create 10 new published demo blogs

-- First, get all existing blog IDs for cascade deletion
DO $$ 
DECLARE
    blog_ids uuid[];
BEGIN
    -- Get all blog post IDs
    SELECT array_agg(id) INTO blog_ids FROM blog_posts;
    
    -- Delete related data first (cascade style)
    IF blog_ids IS NOT NULL THEN
        DELETE FROM blog_ai_summaries WHERE post_id = ANY(blog_ids);
        DELETE FROM blog_post_feedback WHERE post_id = ANY(blog_ids);
        DELETE FROM blog_shares WHERE post_id = ANY(blog_ids);
        DELETE FROM blog_reactions WHERE post_id = ANY(blog_ids);
        DELETE FROM blog_comments WHERE post_id = ANY(blog_ids);
        DELETE FROM blog_post_tags WHERE post_id = ANY(blog_ids);
    END IF;
    
    -- Delete all blog posts
    DELETE FROM blog_posts;
    
    RAISE NOTICE 'Deleted % existing blogs and related data', array_length(blog_ids, 1);
END $$;