import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Helper to generate random number in range
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to generate rich media content sections
const generateSections = (title: string): string => {
  const sections = [
    {
      heading: "# Clinical Overview",
      content: `Understanding ${title.toLowerCase()} requires a comprehensive approach to patient assessment and management. Evidence-based protocols guide our clinical decision-making process.

**Key clinical indicators:**
- Patient presentation patterns
- Diagnostic criteria and biomarkers  
- Risk stratification protocols
- Treatment response monitoring

![Clinical Assessment](https://picsum.photos/800/400?random=${random(1, 100)})
*Figure 1: Clinical assessment workflow and decision tree*`
    },
    {
      heading: "# Pathophysiology and Mechanisms",
      content: `The underlying pathophysiological mechanisms involve complex interactions between multiple organ systems.

**Core mechanisms include:**
- Cellular dysfunction pathways
- Inflammatory cascade activation
- Hemodynamic alterations
- Metabolic disturbances

[Educational Video: Pathophysiology Explained](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

For detailed molecular mechanisms, refer to our [research summary](https://example.com/research.pdf).`
    },
    {
      heading: "# Evidence-Based Management",
      content: `Current guidelines emphasize early recognition and prompt intervention to optimize patient outcomes.

**Management priorities:**
1. Immediate stabilization measures
2. Targeted therapeutic interventions
3. Monitoring and reassessment
4. Disposition planning

![Treatment Algorithm](https://picsum.photos/600/800?random=${random(101, 200)})
*Figure 2: Evidence-based treatment algorithm*

**Audio summary:** [Listen to expert commentary](https://www.soundjay.com/misc/bell-ringing-05.wav)`
    },
    {
      heading: "# Quality Metrics and Outcomes",
      content: `Tracking quality metrics ensures continuous improvement in patient care delivery.

**Key performance indicators:**
- Time to recognition (minutes)
- Treatment initiation rates
- Length of stay optimization
- Patient satisfaction scores

![Quality Dashboard](https://picsum.photos/900/500?random=${random(201, 300)})
*Figure 3: Quality metrics dashboard showing performance trends*`
    },
    {
      heading: "# Case Studies and Learning",
      content: `Real-world cases provide valuable learning opportunities for clinical decision-making.

**Case presentation highlights:**
- Complex diagnostic challenges
- Multidisciplinary care coordination
- Unexpected complications management
- Long-term follow-up outcomes

Download our comprehensive [case study collection](https://example.com/cases.pdf) for detailed analysis.`
    },
    {
      heading: "# Future Directions",
      content: `Emerging research and technological advances continue to reshape clinical practice.

**Innovation areas:**
- Artificial intelligence integration
- Precision medicine approaches
- Telemedicine applications
- Predictive analytics tools

![Innovation Pipeline](https://picsum.photos/700/600?random=${random(301, 400)})
*Figure 4: Technology integration roadmap for clinical practice*`
    }
  ];

  const numSections = random(3, 6);
  return sections.slice(0, numSections).map(s => `${s.heading}\n\n${s.content}`).join('\n\n---\n\n');
};

// Generate AI summary for a blog
const generateAISummary = async (title: string, content: string): Promise<string> => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a medical education expert. Create a concise 2-3 sentence summary of the blog post that highlights the key clinical insights and learning objectives.'
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nContent: ${content.substring(0, 1000)}...`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'AI summary will be generated shortly.';
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return 'AI summary will be generated shortly.';
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  // Handle DELETE for cleanup
  if (req.method === 'DELETE') {
    try {
      console.log('Starting demo blog cleanup...');
      
      // Delete demo blogs and related data
      const { data: demoBlogs } = await supabase
        .from('blog_posts')
        .select('id')
        .contains('tags', ['demo']);
      
      if (demoBlogs && demoBlogs.length > 0) {
        const blogIds = demoBlogs.map(b => b.id);
        
        // Delete related data first
        await supabase.from('blog_ai_summaries').delete().in('post_id', blogIds);
        await supabase.from('blog_post_feedback').delete().in('post_id', blogIds);
        await supabase.from('blog_shares').delete().in('post_id', blogIds);
        await supabase.from('blog_likes').delete().in('post_id', blogIds);
        await supabase.from('blog_comments').delete().in('post_id', blogIds);
        
        // Delete blog posts
        await supabase.from('blog_posts').delete().contains('tags', ['demo']);
        
        console.log(`Deleted ${blogIds.length} demo blogs`);
        
        return new Response(JSON.stringify({ 
          deleted: blogIds.length,
          message: 'Demo blogs cleaned up successfully'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      return new Response(JSON.stringify({ 
        deleted: 0,
        message: 'No demo blogs found to delete'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
      
    } catch (err: any) {
      console.error('Demo blog cleanup error:', err);
      return new Response(JSON.stringify({ error: err?.message || 'Cleanup failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
  
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    console.log('Starting demo blog seeding...');

    // Clean up legacy imported blogs first
    console.log('Cleaning up legacy blogs...');
    
    // Get the imported category ID
    const { data: importedCategory } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('title', 'Imported')
      .single();

    // Delete legacy blogs (imported category or draft status)
    let legacyQuery = supabase
      .from('blog_posts')
      .select('id, category_id, status');
    
    if (importedCategory) {
      legacyQuery = legacyQuery.or(`category_id.eq.${importedCategory.id},status.eq.draft`);
    } else {
      legacyQuery = legacyQuery.eq('status', 'draft');
    }

    const { data: legacyBlogs } = await legacyQuery;
    
    if (legacyBlogs && legacyBlogs.length > 0) {
      const legacyIds = legacyBlogs.map(b => b.id);
      console.log(`Deleting ${legacyIds.length} legacy blogs...`);
      
      // Delete related data first
      await supabase.from('blog_ai_summaries').delete().in('post_id', legacyIds);
      await supabase.from('blog_post_feedback').delete().in('post_id', legacyIds);
      await supabase.from('blog_shares').delete().in('post_id', legacyIds);
      await supabase.from('blog_reactions').delete().in('post_id', legacyIds);
      await supabase.from('blog_comments').delete().in('post_id', legacyIds);
      await supabase.from('blog_posts').delete().in('id', legacyIds);
    }

    // Check if we already have demo blogs (but allow re-seeding after cleanup)
    const { count: existingCount } = await supabase
      .from('blog_posts')
      .select('*', { head: true, count: 'exact' })
      .eq('status', 'published');

    console.log(`Found ${existingCount || 0} existing published blogs after cleanup`);
    
    // Skip if we already have demo content (prevent duplicate seeding)
    if ((existingCount || 0) >= 8) {
      return new Response(JSON.stringify({ 
        inserted: 0, 
        total_published_after: existingCount,
        message: 'Demo blogs already exist (8+ published posts found)'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get Test Admin user ID
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('full_name', 'Test Admin')
      .single();

    const authorId = adminUser?.user_id || crypto.randomUUID();

    // Get available categories (excluding 'Imported' and 'Temporary')
    const { data: categories } = await supabase
      .from('blog_categories')
      .select('id, name')
      .not('name', 'in', '("Imported","Temporary")')
      .limit(4);

    if (!categories || categories.length === 0) {
      const { data: newCategory } = await supabase
        .from('blog_categories')
        .insert({
          name: 'Clinical Compendium',
          title: 'Clinical Compendium',
          slug: 'clinical-compendium',
          description: 'Evidence-based clinical content and case studies'
        })
        .select('id')
        .single();
      categories = [newCategory];
    }

    const now = new Date().toISOString();
    
    const blogTemplates = [
      {
        title: 'Advanced Cardiac Life Support: 2024 Guidelines Update',
        slug: 'acls-2024-guidelines-update',
        description: 'Comprehensive review of the latest ACLS guidelines with practical implementation strategies for emergency departments.',
      },
      {
        title: 'Sepsis Recognition and Early Management in the ED',
        slug: 'sepsis-recognition-early-management',
        description: 'Evidence-based approach to rapid sepsis identification and bundle compliance in emergency settings.',
      },
      {
        title: 'Pediatric Emergency Medicine: Common Pitfalls and Solutions',
        slug: 'pediatric-emergency-medicine-pitfalls',
        description: 'Critical insights into pediatric emergency care with focus on age-specific assessment and intervention strategies.',
      },
      {
        title: 'Trauma Surgery Decision Making: When to Operate',
        slug: 'trauma-surgery-decision-making',
        description: 'Strategic approach to trauma surgery decisions with emphasis on timing, resource allocation, and patient outcomes.',
      },
      {
        title: 'Emergency Ultrasound: Point-of-Care Applications',
        slug: 'emergency-ultrasound-applications',
        description: 'Practical guide to bedside ultrasound techniques for rapid diagnosis and procedural guidance in emergency medicine.',
      },
      {
        title: 'Toxicology Emergencies: Antidotes and Management',
        slug: 'toxicology-emergencies-antidotes',
        description: 'Systematic approach to poisoning cases with focus on rapid identification and targeted antidote therapy.',
      },
      {
        title: 'Mechanical Ventilation in Emergency Medicine',
        slug: 'mechanical-ventilation-emergency',
        description: 'Essential ventilator management principles for emergency physicians with emphasis on lung-protective strategies.',
      },
      {
        title: 'Stroke Care Protocols: Time-Critical Interventions',
        slug: 'stroke-care-protocols-interventions',
        description: 'Comprehensive stroke care pathway from recognition to reperfusion with focus on minimizing door-to-treatment times.',
      },
      {
        title: 'Pain Management in the Emergency Department',
        slug: 'pain-management-emergency-department',
        description: 'Multimodal analgesia strategies for emergency pain management with consideration of safety and efficacy profiles.',
      },
      {
        title: 'Critical Care Transport: Stabilization and Transfer',
        slug: 'critical-care-transport-stabilization',
        description: 'Best practices for patient stabilization and safe transport in critical care scenarios with inter-facility transfers.',
      }
    ];

    const blogs = [];
    const shares = [];
    const feedback = [];
    const summaries = [];

    for (let i = 0; i < 10; i++) {
      const template = blogTemplates[i];
      const content = generateSections(template.title);
      const viewCount = random(50, 800);
      const likesCount = random(5, 75);
      const commentsCount = random(0, 25);
      const sharesCount = random(1, 15);
      const coverImageId = random(1, 100);
      
      // Randomly assign category from available ones
      const randomCategory = categories[random(0, categories.length - 1)];
      
      const blog = {
        id: crypto.randomUUID(),
        title: template.title,
        slug: template.slug,
        description: template.description,
        content: content,
        cover_image_url: `https://picsum.photos/1200/600?random=${coverImageId}`,
        category_id: randomCategory.id,
        author_id: authorId,
        status: 'published',
        view_count: viewCount,
        likes_count: likesCount,
        is_featured: i < 3, // First 3 blogs are featured
        tags: [], // Normal published content, no demo tag
        created_at: new Date(Date.now() - random(1, 45) * 24 * 60 * 60 * 1000).toISOString(), // Random dates within last 45 days
        updated_at: now,
        published_at: now,
      };

      blogs.push(blog);

      // Generate shares
      const shareCount = random(2, 5);
      for (let j = 0; j < shareCount; j++) {
        shares.push({
          id: crypto.randomUUID(),
          post_id: blog.id,
          user_id: authorId,
          platform: ['twitter', 'linkedin', 'facebook', 'email'][random(0, 3)],
          created_at: new Date(Date.now() - random(1, 10) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Generate feedback
      const feedbackCount = random(2, 5);
      const feedbackMessages = [
        'Great clinical insights, very practical for our ED workflow.',
        'Would love to see more case studies in future posts.',
        'The visual aids really help understand the concepts better.',
        'Could you elaborate on the contraindications section?',
        'Excellent resource for teaching residents.',
      ];
      
      for (let j = 0; j < feedbackCount; j++) {
        feedback.push({
          id: crypto.randomUUID(),
          post_id: blog.id,
          user_id: authorId,
          message: feedbackMessages[random(0, feedbackMessages.length - 1)],
          status: j === 0 ? 'resolved' : 'new', // First feedback is resolved
          created_at: new Date(Date.now() - random(1, 5) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Generate AI summary
      const summary = await generateAISummary(blog.title, blog.content);
      summaries.push({
        post_id: blog.id,
        summary_md: summary,
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        created_at: now,
      });
    }

    console.log(`Inserting ${blogs.length} blogs, ${shares.length} shares, ${feedback.length} feedback, ${summaries.length} summaries...`);

    // Insert all data
    const { error: blogsError } = await supabase.from('blog_posts').insert(blogs);
    if (blogsError) throw new Error(`Blog insert error: ${blogsError.message}`);

    const { error: sharesError } = await supabase.from('blog_shares').insert(shares);
    if (sharesError) throw new Error(`Shares insert error: ${sharesError.message}`);

    const { error: feedbackError } = await supabase.from('blog_post_feedback').insert(feedback);
    if (feedbackError) throw new Error(`Feedback insert error: ${feedbackError.message}`);

    const { error: summariesError } = await supabase.from('blog_ai_summaries').insert(summaries);
    if (summariesError) throw new Error(`Summaries insert error: ${summariesError.message}`);

    const { count: finalCount } = await supabase
      .from('blog_posts')
      .select('*', { head: true, count: 'exact' })
      .eq('status', 'published');

    console.log('Demo blog seeding completed successfully');

    return new Response(JSON.stringify({ 
      inserted: blogs.length, 
      total_published_after: finalCount || 0,
      shares_created: shares.length,
      feedback_created: feedback.length,
      summaries_created: summaries.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: any) {
    console.error('seed-demo-blogs error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});