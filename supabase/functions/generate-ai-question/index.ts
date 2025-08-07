import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function started, checking auth...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('User authenticated, parsing request...');
    const { examType, difficulty, topic, userId } = await req.json();
    console.log('Request data:', { examType, difficulty, topic });

    // Get user's previous questions to avoid duplicates
    const { data: previousQuestions } = await supabaseClient
      .from('quiz_attempts')
      .select('questions(question_text)')
      .eq('user_id', user.id);

    const previousTexts = previousQuestions?.map(q => q.questions?.question_text).filter(Boolean) || [];

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('OpenAI API key available:', !!openAIApiKey);
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Generate a multiple choice question for medical exam preparation.

Requirements:
- Exam type: ${examType}
- Difficulty: ${difficulty}
- Topic: ${topic}
- Format: Medical education style question
- Include 4 options (A, B, C, D)
- Provide detailed explanation
- Do not generate any of these previous questions: ${previousTexts.slice(0, 10).join(', ')}

Return ONLY a JSON object with this exact structure:
{
  "question_text": "Your question here",
  "option_a": "Option A text",
  "option_b": "Option B text", 
  "option_c": "Option C text",
  "option_d": "Option D text",
  "correct_answer": "A", 
  "explanation": "Detailed explanation here",
  "topic": "${topic}",
  "subtopic": "specific subtopic",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a medical education expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    const generatedText = data.choices[0].message.content;
    
    let questionData;
    try {
      questionData = JSON.parse(generatedText);
    } catch (e) {
      throw new Error('Failed to parse AI response');
    }

    // Save question to database
    const { data: savedQuestion, error } = await supabaseClient
      .from('questions')
      .insert({
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_answer: questionData.correct_answer,
        explanation: questionData.explanation,
        exam_type: examType.toLowerCase(),
        difficulty_level: difficulty.toLowerCase(),
        topic: questionData.topic,
        subtopic: questionData.subtopic,
        keywords: questionData.keywords,
        is_ai_generated: true,
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      question: savedQuestion,
      disclaimer: 'This AI-generated question has not been reviewed by medical experts.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-ai-question function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});