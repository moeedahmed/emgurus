import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function parseAllowlist() {
  const raw = Deno.env.get('ORIGIN_ALLOWLIST') || '*';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
function allowOrigin(origin: string | null) {
  const list = parseAllowlist();
  if (!origin) return '';
  if (list.includes('*')) return origin;
  return list.includes(origin) ? origin : '';
}

const baseCors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_MODEL_EXAM = Deno.env.get('OPENAI_MODEL_EXAM') ?? 'gpt-5.0-pro';
const OPENAI_CHAT_TIMEOUT_MS = Number(Deno.env.get('OPENAI_CHAT_TIMEOUT_MS') ?? '60000');

function resolveModel(label: string): string {
  if (label === 'gpt-5.0-pro') return 'gpt-4o';
  if (label === 'gpt-5.0-nano') return 'gpt-4o-mini';
  return label;
}

function withTimeout(input: RequestInfo | URL, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const allowed = allowOrigin(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403, headers: { ...baseCors } });
    return new Response(null, { headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed } });
  }

  if (!allowed) return new Response('Forbidden', { status: 403, headers: { ...baseCors } });

  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY in Supabase secrets.' }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header found' }), {
        status: 401,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' },
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = await req.json();
    const { examType, difficulty, topic } = requestBody || {};

    // Get user's previous questions to avoid duplicates
    const { data: previousQuestions } = await supabase
      .from('quiz_attempts')
      .select('questions(question_text)')
      .eq('user_id', user.id);

    const previousTexts = previousQuestions?.map((q: any) => q.questions?.question_text).filter(Boolean) || [];

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

    const model = resolveModel(OPENAI_MODEL_EXAM);

    const response = await withTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a medical education expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    }, OPENAI_CHAT_TIMEOUT_MS);

    if (!response.ok) {
      const bodyTxt = await response.text().catch(() => 'OpenAI error');
      return new Response(JSON.stringify({ error: `OpenAI API error: ${response.status} ${response.statusText}`, body: bodyTxt.slice(0,300) }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'x-model-used': model },
      });
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return new Response(JSON.stringify({ error: 'Invalid response from OpenAI API' }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'x-model-used': model },
      });
    }

    const generatedText = data.choices[0].message.content as string;

    let questionData: any;
    try {
      questionData = JSON.parse(generatedText);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'x-model-used': model },
      });
    }

    // Save question to database
    const { data: savedQuestion, error } = await supabase
      .from('questions')
      .insert({
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_answer: questionData.correct_answer,
        explanation: questionData.explanation,
        exam_type: String(examType || '').toLowerCase(),
        difficulty_level: String(difficulty || '').toLowerCase(),
        topic: questionData.topic,
        subtopic: questionData.subtopic,
        keywords: questionData.keywords,
        is_ai_generated: true,
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: String(error?.message || error) }), {
        status: 500,
        headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'x-model-used': model },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      question: savedQuestion,
      disclaimer: 'This AI-generated question has not been reviewed by medical experts.'
    }), {
      headers: { ...baseCors, 'Access-Control-Allow-Origin': allowed, 'Content-Type': 'application/json', 'x-model-used': model },
    });

  } catch (error) {
    console.error('Error in generate-ai-question function:', String((error as Error).message || error));
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...baseCors, 'Access-Control-Allow-Origin': allowOrigin(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }
});
