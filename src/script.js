// /Volumes/SSD 500gb/Project/voicestudio-browser/docuforge/src/script.js

/**
 * @typedef {Object} Scene
 * @property {number} index
 * @property {string} text
 * @property {string[]} keywords
 * @property {string[]} sentences
 */

const STOPWORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'shall', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'not', 'no', 'but', 'or', 'and', 'if', 'then', 'so', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over', 'out', 'up', 'down', 'off', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'very', 'just', 'also', 'than', 'too', 'much', 'many', 'here', 'there', 'when', 'where', 'while', 'how', 'what', 'which', 'who', 'whom', 'whose', 'why', 'been', 'being', 'be', 'am', 'was', 'were', 'is', 'are', 'has', 'have', 'had', 'do', 'does', 'did', 'get', 'got', 'go', 'went', 'come', 'came', 'make', 'made', 'take', 'took', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'give', 'gave', 'find', 'found', 'let', 'put', 'still', 'even', 'well', 'back', 'now', 'way', 'may', 'like', 'use', 'her', 'time', 'one', 'two', 'way', 'look', 'people', 'long', 'day', 'thing', 'man', 'world', 'life', 'hand', 'part', 'again', 'new', 'first', 'last', 'great', 'good', 'old', 'right', 'big', 'high', 'small', 'large', 'next', 'early', 'young'
]);

function splitSentences(text) {
  const raw = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text.trim()];
  const result = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > 300) {
      // Split on commas, rejoin into chunks under 300 chars
      const parts = trimmed.split(/,\s*/);
      let current = '';
      for (const part of parts) {
        if (current && (current + ', ' + part).length > 300) {
          result.push(current.trim());
          current = part;
        } else {
          current = current ? current + ', ' + part : part;
        }
      }
      if (current.trim()) result.push(current.trim());
    } else {
      result.push(trimmed);
    }
  }
  return result.length > 0 ? result : [text.trim()];
}

/**
 * Parses a script into scenes and extracts keywords using basic heuristics.
 * @param {string} text 
 * @returns {Scene[]}
 */
export function parseScript(text) {
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  
  return paragraphs.map((text, index) => {
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const filtered = words.filter(w => !STOPWORDS.has(w));
    
    // Count frequencies
    const freq = new Map();
    for (const w of filtered) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    
    // Sort by frequency descending, then by length descending
    const sorted = Array.from(freq.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    });

    let keywords = sorted.slice(0, 2).map(entry => entry[0]);
    if (keywords.length === 0) {
      keywords = ['documentary', 'footage'];
    }

    const sentences = splitSentences(text);

    return { index, text, keywords, sentences };
  });
}

/**
 * Enhances scene keywords using an LLM.
 * @param {Scene[]} scenes 
 * @param {string} apiKey 
 * @param {string} [provider='gemini'] 
 * @returns {Promise<Scene[]>}
 */
export async function enhanceKeywords(scenes, apiKey, provider = 'gemini') {
  if (!apiKey || scenes.length === 0) return scenes;

  try {
    const prompt = `For each scene, return 2 search keywords for stock footage. Return JSON array of {keywords: [string, string]}.\n\nScenes:\n${scenes.map((s, i) => `[${i}] ${s.text}`).join('\n')}`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (responseText) {
        const jsonStr = responseText.replace(/^```json/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            return scenes.map((scene, i) => {
                const llmKeywords = parsed[i]?.keywords;
                return {
                    ...scene,
                    keywords: Array.isArray(llmKeywords) && llmKeywords.length > 0 ? llmKeywords : scene.keywords
                };
            });
        }
      }
    } else {
        console.warn(`Provider ${provider} is not fully implemented in enhanceKeywords, falling back to basic keywords.`);
    }
  } catch (err) {
    console.warn('Failed to enhance keywords, falling back to heuristics:', err);
  }

  return scenes;
}
