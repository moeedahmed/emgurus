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

// Helper to generate rich content sections
const generateRichContent = (title: string, index: number): string => {
  return `# ${title}

## Clinical Overview

Understanding ${title.toLowerCase()} requires a comprehensive approach to patient assessment and management. Evidence-based protocols guide our clinical decision-making process in modern emergency medicine practice.

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

![Clinical Assessment Chart](https://picsum.photos/seed/${index}/600/300 "Evidence-based clinical assessment flowchart")

## <details><summary>🎥 Educational Video Content (Click to expand)</summary>

**Advanced Techniques in ${title}**

<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

This comprehensive video covers:
- Step-by-step demonstration of key procedures
- Common pitfalls and how to avoid them  
- Expert commentary from leading emergency physicians
- Real case scenarios and decision-making processes

</details>

## <details><summary>🎧 Audio Learning Resources (Click to expand)</summary>

**Podcast: Emergency Medicine Insights**

<audio controls>
  <source src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>

Expert discussion featuring:
- Dr. Sarah Chen - Emergency Medicine Attending
- Dr. Michael Rodriguez - Critical Care Specialist
- Topics: Latest research, clinical pearls, case discussions

Duration: 45 minutes | Released: ${new Date().toLocaleDateString()}

</details>

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

## <details><summary>📋 Clinical Guidelines & Resources (Click to expand)</summary>

**Essential Reference Materials:**

📄 [Clinical Practice Guidelines - ${title}.pdf](https://example.com/guidelines-${index}.pdf)

📄 [Quick Reference Card - Emergency Protocols.pdf](https://example.com/quick-ref-${index}.pdf)

📄 [Drug Dosing Calculator - Mobile App.apk](https://example.com/dosing-calc-${index}.apk)

**Additional Resources:**
- Evidence-based decision trees
- Risk assessment calculators  
- Medication interaction checkers
- Patient education materials

</details>

## Quality Metrics & Outcomes

Recent institutional data shows improved outcomes following protocol implementation:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to diagnosis | 45 min | 32 min | 29% ↓ |
| Patient satisfaction | 7.2/10 | 8.7/10 | 21% ↑ |
| Readmission rate | 12.3% | 8.9% | 28% ↓ |
| Cost per case | $2,400 | $2,100 | 13% ↓ |

## <details><summary>💬 Case Discussion & Pearls (Click to expand)</summary>

**Clinical Pearls from Expert Practice:**

> "The key to successful ${title.toLowerCase()} management is early recognition and systematic approach. Don't let common presentations fool you - always consider the differential diagnosis." 
> 
> *Dr. Jennifer Kim, Emergency Medicine Attending*

**Challenging Case Scenario:**
45-year-old patient presents with atypical symptoms. Initial workup unremarkable, but clinical suspicion remains high. This case highlights the importance of clinical judgment over algorithmic approaches.

**Learning Points:**
- Trust your clinical intuition
- Serial assessments can be more valuable than single time point evaluation
- Multidisciplinary team approach improves outcomes
- Patient communication is critical throughout the process

</details>

## Conclusion

Modern emergency medicine requires integration of evidence-based protocols with clinical expertise. Continuous quality improvement and ongoing education ensure optimal patient outcomes in this rapidly evolving field.

**Key Takeaways:**
- Systematic approaches improve diagnostic accuracy
- Team-based care enhances patient safety
- Regular protocol updates reflect current evidence
- Quality metrics guide continuous improvement efforts

---

*Last updated: ${new Date().toLocaleDateString()} | Next review: ${new Date(Date.now() + 6*30*24*60*60*1000).toLocaleDateString()}*`;
};

// Helper to generate AI summary using OpenAI
const generateAISummary = async (title: string, content: string): Promise<string> => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a medical expert assistant. Create a concise, professional summary of the medical blog post content. Focus on key clinical points, evidence, and practical applications. Keep it under 150 words.'
          },
          {
            role: 'user',
            content: `Please summarize this medical blog post titled "${title}":\n\n${content.substring(0, 2000)}`
          }
        ],
        max_completion_tokens: 200
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return `Clinical summary of ${title}: This comprehensive guide covers evidence-based approaches to ${title.toLowerCase()}, including diagnostic criteria, management protocols, and quality improvement metrics. Key focus areas include systematic assessment, team-based care, and outcome optimization.`;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return `Clinical summary of ${title}: This evidence-based guide provides comprehensive coverage of ${title.toLowerCase()} with focus on diagnostic accuracy, treatment protocols, and quality metrics for optimal patient outcomes.`;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  // Handle DELETE for cleanup
  if (req.method === 'DELETE') {
    try {
      console.log('Starting complete blog cleanup...');
      
      // Delete ALL existing blogs (both legacy and demo)
      const { data: allBlogs } = await supabase
        .from('blog_posts')
        .select('id');
      
      if (allBlogs && allBlogs.length > 0) {
        const blogIds = allBlogs.map(b => b.id);
        
        console.log(`Deleting ${blogIds.length} existing blogs and related data...`);
        
        // Delete related data first
        await supabase.from('blog_ai_summaries').delete().in('post_id', blogIds);
        await supabase.from('blog_post_feedback').delete().in('post_id', blogIds);
        await supabase.from('blog_shares').delete().in('post_id', blogIds);
        await supabase.from('blog_reactions').delete().in('post_id', blogIds);
        await supabase.from('blog_comments').delete().in('post_id', blogIds);
        
        // Delete blog posts
        await supabase.from('blog_posts').delete().in('id', blogIds);
        
        console.log(`Deleted ${blogIds.length} blogs`);
        
        return new Response(JSON.stringify({ 
          deleted: blogIds.length,
          message: 'All blogs cleaned up successfully'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      return new Response(JSON.stringify({ 
        deleted: 0,
        message: 'No blogs found to delete'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
      
    } catch (err: any) {
      console.error('Blog cleanup error:', err);
      return new Response(JSON.stringify({ error: err?.message || 'Cleanup failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
  
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    console.log('Starting demo blog seeding...');

    // Clean up ALL existing blogs first (legacy and drafts)
    console.log('Cleaning up all existing blogs...');
    
    // Get imported category for targeted cleanup
    const { data: importedCategory } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('title', 'Imported')
      .single();

    // Delete legacy blogs (imported category OR draft status OR all existing)
    let legacyQuery = supabase.from('blog_posts').select('id, category_id, status');
    
    if (importedCategory) {
      legacyQuery = legacyQuery.or(`category_id.eq.${importedCategory.id},status.eq.draft,status.eq.in_review`);
    } else {
      // If no imported category, just delete drafts and existing published
      legacyQuery = legacyQuery.neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
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

    // Get Test Admin user ID
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('full_name', '%admin%')
      .limit(1)
      .single();

    const authorId = adminUser?.user_id || 'cefb1a10-af1c-4c28-9fc0-46f91a804eea'; // fallback

    // Get available categories (excluding 'Imported' and 'Temporary')
    const { data: categories } = await supabase
      .from('blog_categories')
      .select('id, title')
      .in('title', ['General', 'Clinical Compendium', 'Exam Guidance', 'Careers', 'Research & Evidence'])
      .limit(5);

    if (!categories || categories.length === 0) {
      throw new Error('No valid categories found');
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
        title: 'Mental Health Crisis Intervention in Emergency Settings',
        slug: 'mental-health-crisis-intervention',
        description: 'Comprehensive approach to psychiatric emergencies with focus on de-escalation, safety, and appropriate disposition.',
      },
      {
        title: 'Toxicology Emergencies: Rapid Assessment and Management',
        slug: 'toxicology-emergencies-management',
        description: 'Evidence-based protocols for common poisonings with emphasis on rapid recognition and targeted therapy.',
      },
      {
        title: 'Airway Management: Advanced Techniques and Troubleshooting',
        slug: 'airway-management-advanced-techniques',
        description: 'Expert strategies for difficult airway scenarios with focus on backup plans and emergency surgical airways.',
      },
      {
        title: 'Pain Management in Emergency Medicine: Multimodal Approaches',
        slug: 'pain-management-multimodal-approaches',
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
      const content = generateRichContent(template.title, i + 1);
      const viewCount = random(10, 500);
      const likesCount = random(0, 100);
      const sharesCount = random(1, 20);
      const feedbackCount = random(0, 15);
      
      // Randomly assign category from available ones
      const randomCategory = categories[random(0, categories.length - 1)];
      
      const blog = {
        id: crypto.randomUUID(),
        title: template.title,
        slug: template.slug,
        description: template.description,
        content: content,
        cover_image_url: `https://picsum.photos/seed/${i + 1}/800/400`,
        category_id: randomCategory.id,
        author_id: authorId,
        status: 'published',
        published_at: now,
        view_count: viewCount,
        likes_count: likesCount,
        is_featured: i < 3, // First 3 blogs are featured
        created_at: new Date(Date.now() - random(1, 30) * 24 * 60 * 60 * 1000).toISOString(), // Random dates within last 30 days
        updated_at: now,
      };

      blogs.push(blog);

      // Generate shares
      for (let j = 0; j < sharesCount; j++) {
        shares.push({
          id: crypto.randomUUID(),
          post_id: blog.id,
          user_id: authorId,
          platform: ['twitter', 'linkedin', 'facebook', 'email'][random(0, 3)],
          created_at: new Date(Date.now() - random(1, 15) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Generate feedback
      for (let k = 0; k < feedbackCount; k++) {
        feedback.push({
          id: crypto.randomUUID(),
          post_id: blog.id,
          user_id: authorId,
          message: [
            "Excellent clinical insights, very practical for emergency medicine practice.",
            "Great evidence-based approach, will definitely implement these protocols.",
            "Clear and concise presentation of complex clinical concepts.",
            "Valuable resource for emergency medicine practitioners.",
            "Well-structured content with actionable clinical pearls."
          ][random(0, 4)],
          status: 'new',
          created_at: new Date(Date.now() - random(1, 10) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Generate AI summary
      const summary = await generateAISummary(blog.title, blog.content);
      summaries.push({
        post_id: blog.id,
        summary_md: summary,
        model: 'gpt-5-nano-2025-08-07',
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
      message: 'Demo blogs created successfully'
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