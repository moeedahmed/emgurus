import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationRequest {
  exam: string;
  topic?: string;
  difficulty: string;
  count: number;
  customPrompt?: string;
}

interface GeneratedQuestion {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Question generation request received');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { exam, topic, difficulty, count, customPrompt }: GenerationRequest = await req.json();

    console.log('Generation parameters:', { exam, topic, difficulty, count, customPrompt });

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Construct the generation prompt
    let basePrompt = `Generate ${count} ${difficulty}-level multiple choice questions (MCQs) for the ${exam} exam`;
    if (topic) {
      basePrompt += ` on the topic of ${topic}`;
    }
    basePrompt += '.';

    if (customPrompt) {
      basePrompt += ` ${customPrompt}`;
    }

    const systemPrompt = `You are an expert medical educator creating high-quality multiple choice questions for medical examinations. 

Generate exactly ${count} questions in the following JSON format:
{
  "questions": [
    {
      "stem": "The question text here...",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
      "correctIndex": 0,
      "explanation": "Detailed explanation of why the correct answer is right and others are wrong...",
      "reference": "Citation or reference (optional)"
    }
  ]
}

Requirements:
- Each question must be clinically relevant and accurate
- Provide 5 options (A-E) per question
- Include comprehensive explanations
- Use appropriate medical terminology
- Ensure questions are at the specified difficulty level
- Questions should be suitable for ${exam} examination level
- Return valid JSON only, no additional text`;

    console.log('Making OpenAI API call...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: basePrompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    const generatedContent = data.choices[0].message.content;
    console.log('Generated content:', generatedContent);

    let questions: GeneratedQuestion[];
    try {
      const parsed = JSON.parse(generatedContent);
      questions = parsed.questions;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content:', generatedContent);
      throw new Error('Failed to parse generated questions');
    }

    if (!questions || !Array.isArray(questions)) {
      throw new Error('Invalid questions format received from AI');
    }

    console.log(`Generated ${questions.length} questions successfully`);

    // Log the generation for analytics
    try {
      await supabase.from('ai_gen_logs').insert({
        user_id: user.id,
        source: 'admin-question-generator',
        exam: exam,
        count: questions.length,
        success: true,
        model_used: 'gpt-4.1-2025-04-14'
      });
    } catch (logError) {
      console.error('Failed to log generation:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({ 
      questions,
      prompt: basePrompt,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-ai-question function:', error);
    
    // Try to log the error
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase.from('ai_gen_logs').insert({
            user_id: user.id,
            source: 'admin-question-generator',
            success: false,
            error_code: error.message,
            model_used: 'gpt-4.1-2025-04-14'
          });
        }
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});