/**
 * llm.js - Optional Free-Tier LLM Script Generator
 * 
 * Supports Google Gemini (gemini-flash-latest) with mode-specific JSON schemas.
 * Zero-cost invariant: optional extras only. If no key is provided, the app operates
 * 100% offline via local paragraph parsing and heuristic keyword extraction.
 */

export const MODE_SCHEMAS = {
  'viral': {
    systemPrompt: 'You are a viral short-form video scriptwriter. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        hook: { type: 'string', description: 'Curiosity gap hook (max 15 words)' },
        facts: { type: 'array', items: { type: 'string' }, description: '2 to 3 fast-paced surprising facts' },
        cta: { type: 'string', description: 'Punchy closing statement or question' }
      },
      required: ['hook', 'facts', 'cta']
    }
  },
  'reddit-story': {
    systemPrompt: 'You are a dramatic Reddit storyteller. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        subreddit: { type: 'string', description: 'e.g. r/AskReddit, r/tifu, r/confession' },
        username: { type: 'string', description: 'e.g. u/throwaway_curious' },
        title: { type: 'string', description: 'Dramatic story title' },
        upvotes: { type: 'string', description: 'e.g. 24.5k' },
        comments: { type: 'string', description: 'e.g. 1.8k' },
        story: { type: 'string', description: 'Urgent, gripping first-person narrative' }
      },
      required: ['subreddit', 'username', 'title', 'upvotes', 'comments', 'story']
    }
  },
  'explainer': {
    systemPrompt: 'You are a documentary top list / educational scriptwriter. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Listicle title (e.g. Top 3 Deadliest Volcanoes)' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'integer' },
              name: { type: 'string' },
              line: { type: 'string', description: '1-2 sentence explanation' }
            },
            required: ['rank', 'name', 'line']
          }
        }
      },
      required: ['title', 'items']
    }
  },
  'myth-vs-fact': {
    systemPrompt: 'You write concise Myth vs Fact scripts. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        myth: { type: 'string', description: 'Commonly believed misconception' },
        fact: { type: 'string', description: 'The scientifically accurate truth' },
        explanation: { type: 'string', description: 'Brief 1-2 sentence breakdown of why' }
      },
      required: ['myth', 'fact', 'explanation']
    }
  },
  'quote-motivational': {
    systemPrompt: 'You write serene stoic and motivational wisdom. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        quote: { type: 'string', description: 'Profound timeless quote' },
        author: { type: 'string', description: 'Author or philosopher name' },
        context: { type: 'string', description: '1 sentence reflection' }
      },
      required: ['quote', 'author']
    }
  },
  'quiz-trivia': {
    systemPrompt: 'You write energetic game show trivia questions. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Intriguing trivia question' },
        options: { type: 'array', items: { type: 'string' }, description: 'Exactly 4 distinct choices' },
        correctIndex: { type: 'integer', description: '0 to 3' },
        funFact: { type: 'string', description: '1 sentence reveal explanation' }
      },
      required: ['question', 'options', 'correctIndex', 'funFact']
    }
  },
  'would-you-rather': {
    systemPrompt: 'You write compelling Would You Rather dilemmas. Output JSON matching the schema.',
    schema: {
      type: 'object',
      properties: {
        optionA: { type: 'string', description: 'First option' },
        optionB: { type: 'string', description: 'Second option' },
        voteA: { type: 'integer', description: 'Community vote % for A (0-100)' },
        voteB: { type: 'integer', description: 'Community vote % for B (100 - voteA)' }
      },
      required: ['optionA', 'optionB', 'voteA', 'voteB']
    }
  }
};

export async function generateScriptWithGemini(topic, mode, apiKey) {
  if (!apiKey) throw new Error('Gemini API key not supplied.');

  const modeConfig = MODE_SCHEMAS[mode] || MODE_SCHEMAS['viral'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `${modeConfig.systemPrompt}\nTopic: "${topic}".\nReturn only valid JSON matching the schema.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.7
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini.');

  const cleaned = rawText.replace(/^```json/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}
