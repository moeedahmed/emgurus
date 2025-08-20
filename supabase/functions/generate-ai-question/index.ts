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
  options: { text: string; explanation: string }[];
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
    
    // Validate OpenAI API key first
    if (!openAIApiKey || openAIApiKey.trim() === '') {
      console.error('OpenAI API key is missing or empty');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in Supabase secrets.',
        success: false 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
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
      "options": [
        { "text": "Option A text", "explanation": "Why this option is incorrect..." },
        { "text": "Option B text", "explanation": "Why this option is correct..." },
        { "text": "Option C text", "explanation": "Why this option is incorrect..." },
        { "text": "Option D text", "explanation": "Why this option is incorrect..." },
        { "text": "Option E text", "explanation": "Why this option is incorrect..." }
      ],
      "correctIndex": 1,
      "explanation": "Overall explanation summarizing the concept...",
      "reference": "Citation or reference (optional)"
    }
  ]
}

Requirements:
- Each question must be clinically relevant and accurate
- Provide 5 options (A-E) per question with individual explanations
- Each option should have its own explanation (why it's correct or incorrect)
- Include comprehensive overall explanations
- Use appropriate medical terminology
- Ensure questions are at the specified difficulty level
- Questions should be suitable for ${exam} examination level
- Return valid JSON only, no additional text`;

    console.log('Making OpenAI API call...');

    const requestBody = {
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: basePrompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    };

    console.log('OpenAI request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      // Propagate OpenAI errors with proper status codes
      let status = 500;
      let errorMessage = `OpenAI API error: ${response.status} ${errorText}`;
      
      if (response.status === 400) {
        status = 400;
        errorMessage = 'Invalid request to OpenAI API. Please check your parameters.';
      } else if (response.status === 401) {
        status = 401;
        errorMessage = 'OpenAI API authentication failed. Please check your API key.';
      } else if (response.status === 404) {
        status = 404;
        errorMessage = 'OpenAI model not found. Please check the model name.';
      } else if (response.status === 429) {
        status = 429;
        errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        success: false,
        openai_status: response.status 
      }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('OpenAI response received successfully');
    console.log('OpenAI response data:', JSON.stringify(data, null, 2));

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
        model_used: 'gpt-4-turbo'
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
            model_used: 'gpt-4-turbo'
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