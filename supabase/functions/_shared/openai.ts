// Shared OpenAI helper for Supabase Edge Functions

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  model?: string;
  responseFormat?: 'text' | 'json_object';
  maxTokens?: number;
  temperature?: number;
}

export function getOpenAI() {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI key not configured');
  }
  return apiKey;
}

export async function chat(options: ChatOptions): Promise<string> {
  const apiKey = getOpenAI();
  const model = options.model || Deno.env.get('OPENAI_MODEL_CHAT') || 'gpt-4o-mini';
  
  const messages: ChatMessage[] = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }
  messages.push(...options.messages);

  const payload: any = {
    model,
    messages,
    max_tokens: options.maxTokens || 800,
  };

  // Only add temperature for older models
  if (options.temperature !== undefined && !model.includes('gpt-5') && !model.includes('o3') && !model.includes('o4')) {
    payload.temperature = options.temperature;
  }

  if (options.responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  const attempt = async (): Promise<string> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    return content;
  };

  // Retry logic
  try {
    return await attempt();
  } catch (error) {
    console.warn('OpenAI first attempt failed, retrying...', error);
    return await attempt();
  }
}