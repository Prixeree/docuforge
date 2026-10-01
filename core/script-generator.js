/**
 * script-generator.js - Autonomous & BYOK Script Generation Engine
 * 
 * Features:
 * 1. Autonomous In-Browser Generator: Zero-cost, 100% offline procedural script synthesis.
 *    Generates complete high-retention scripts for all 7 modes across endless topics.
 * 2. BYOK (Bring Your Own Key) Integration: Supports Google Gemini API (gemini-flash)
 *    when the user supplies their own free-tier API key in the UI settings.
 * 3. Fallback Guarantee: If an external LLM call fails or times out, seamlessly falls back
 *    to the autonomous procedural engine so video production never stalls.
 */

import { generateScriptWithGemini, MODE_SCHEMAS } from './llm.js';

export const AUTONOMOUS_TOPIC_BANKS = {
  'viral': [
    {
      topic: 'Deep Ocean Mysteries',
      hook: 'Did you know the deepest place on Earth contains living alien creatures?',
      facts: [
        'At the bottom of the Mariana Trench, the water pressure is equal to having fifty jumbo jets stacked on top of you.',
        'Creatures down there produce their own bioluminescent light because sunlight has not touched the ocean floor in billions of years.',
        'Scientists recently discovered single-celled organisms thriving near boiling volcanic vents at four hundred degrees.'
      ],
      cta: 'Subscribe if you would explore the ocean depths!'
    },
    {
      topic: 'Immortal Honey',
      hook: 'Did you know this insane biological fact about raw honey?',
      facts: [
        'Raw honey has almost zero moisture and high natural acidity, meaning bacteria cannot survive inside it.',
        'Archaeologists excavating ancient Egyptian tombs opened sealed clay jars and found perfectly edible 3,000-year-old honey.'
      ],
      cta: 'Follow for more mind-blowing discoveries!'
    },
    {
      topic: 'Space Rogue Planets',
      hook: 'There are trillions of ghost planets wandering completely alone in deep space.',
      facts: [
        'Astronomers calculate that rogue planets outnumber normal stars in our Milky Way by billions.',
        'These worlds were violently ejected from their solar systems and now drift forever through pitch-black interstellar space.',
        'Some rogue planets maintain liquid oceans beneath thick crusts of ice, heated by internal radioactive cores.'
      ],
      cta: 'Drop a like if space terrifies and fascinates you!'
    },
    {
      topic: 'The Human Supercomputer',
      hook: 'Your brain performs one quintillion mathematical operations every single second.',
      facts: [
        'If you tried to build an electronic computer with the same processing power as your brain, it would require a whole nuclear power plant.',
        'Nerve impulses travel through your nervous system at speeds exceeding two hundred and seventy miles per hour.',
        'Every second, your body replaces over three million red blood cells without you feeling a thing.'
      ],
      cta: 'Share this with someone who needs to hear how incredible they are!'
    }
  ],

  'reddit-story': [
    {
      subreddit: 'r/tifu',
      username: 'u/throwaway_curious',
      title: 'I accidentally won an international trivia contest I never signed up for',
      upvotes: '38.4k',
      comments: '2.1k',
      story: `It all started when I was waiting at an airport terminal during a six-hour flight delay. A random push notification appeared on my phone asking for a trivia participant.
Thinking it was just another mobile game ad, I breezed through thirty impossible history and geography questions in under two minutes.
An hour later, two airport security guards approached my gate with a microphone and a giant cardboard check for ten thousand dollars.`
    },
    {
      subreddit: 'r/confession',
      username: 'u/midnight_coder',
      title: 'I automated my entire tech job for three years and no one noticed',
      upvotes: '52.1k',
      comments: '4.8k',
      story: `Three years ago I landed an entry-level data processing role where I was supposed to clean spreadsheets for eight hours a day.
During my second week, I wrote a 40-line Python script that executed the entire daily workload in under four minutes.
Instead of telling anyone, I scheduled the script to trigger randomly throughout the afternoon. I spent the last three years studying philosophy and reading books.`
    },
    {
      subreddit: 'r/AskReddit',
      username: 'u/urban_wanderer',
      title: 'The mysterious key my landlord left behind led to a secret underground room',
      upvotes: '44.9k',
      comments: '3.2k',
      story: `When my eccentric elderly landlord moved out, he left an unlabelled brass skeleton key tucked inside the hallway fuse box.
Curiosity got the better of me. After searching the cellar floorboards, I found a hidden trapdoor concealed beneath an antique Persian rug.
Down below was a fully furnished 1970s listening lounge with hundreds of pristine vinyl records and working analog synthesizers.`
    }
  ],

  'explainer': [
    {
      title: 'Top 3 Deadliest Natural Formations on Earth',
      items: [
        { rank: 3, name: 'Danakil Depression', line: 'The Danakil Depression in Ethiopia features boiling acid lakes, bubbling neon pools, and toxic sulfur geysers.' },
        { rank: 2, name: 'Lake Natron', line: 'Lake Natron in Tanzania has alkaline water so caustic with soda ash that it calcifies animal remains into stone.' },
        { rank: 1, name: 'Mount Nyiragongo', line: 'Mount Nyiragongo holds the largest and fastest-moving lake of molten lava ever recorded in human history.' }
      ]
    },
    {
      title: 'Top 3 Rarest Minerals on Planet Earth',
      items: [
        { rank: 3, name: 'Taaffeite', line: 'Taaffeite is a violet gemstone so rare that only a handful of cut specimens are known to exist in world collections.' },
        { rank: 2, name: 'Painite', line: 'Painite was once declared by Guinness World Records as the single rarest mineral on Earth, with only two crystals found for decades.' },
        { rank: 1, name: 'Kyawthuite', line: 'Kyawthuite is a deep orange-red crystal found in Myanmar. To this day, only one solitary gemstone has ever been discovered.' }
      ]
    },
    {
      title: 'Top 3 Deepest Ocean Trenches in the World',
      items: [
        { rank: 3, name: 'Philippine Trench', line: 'The Philippine Trench plunges over thirty-four thousand feet down, created by catastrophic tectonic subduction.' },
        { rank: 2, name: 'Tonga Trench', line: 'The Tonga Trench reaches thirty-five thousand feet and houses the Horizon Deep, one of the coldest abysses on Earth.' },
        { rank: 1, name: 'Mariana Trench', line: 'The Mariana Trench drops nearly thirty-six thousand feet into the Challenger Deep, plunging deeper than Mount Everest is tall.' }
      ]
    }
  ],

  'myth-vs-fact': [
    {
      myth: 'Humans only use ten percent of their brain capacity.',
      fact: 'Brain scans prove you use virtually one hundred percent of your brain throughout the day.',
      explanation: 'Neurological imaging shows that even while sleeping or resting, almost every region of the human brain remains actively firing.'
    },
    {
      myth: 'The Great Wall of China is visible from space with the naked eye.',
      fact: 'The Great Wall cannot be seen from low Earth orbit without powerful camera magnification.',
      explanation: 'Astronauts confirm that because the wall is made of local stones matching surrounding hills, it blends completely into the natural terrain.'
    },
    {
      myth: 'Lightning never strikes the same place twice.',
      fact: 'Lightning routinely strikes the exact same location dozens of times every year.',
      explanation: 'The Empire State Building in New York City is struck by natural lightning bolts an average of twenty-five times every single year.'
    },
    {
      myth: 'Goldfish only have a three-second memory span.',
      fact: 'Goldfish possess memory retention lasting for at least five to six months.',
      explanation: 'Behavioral experiments prove goldfish can learn complex navigational mazes, recognize human faces, and anticipate regular feeding schedules.'
    }
  ],

  'quote-motivational': [
    {
      quote: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
      author: 'Marcus Aurelius',
      context: 'The ancient Roman emperor reminding us that inner sovereignty is the ultimate human power.'
    },
    {
      quote: 'We suffer more often in imagination than in reality.',
      author: 'Seneca',
      context: 'A timeless Stoic reminder that worry is merely a ghost created by an untrained mind.'
    },
    {
      quote: 'It is not what happens to you, but how you react to it that matters.',
      author: 'Epictetus',
      context: 'Freedom begins the exact moment you detach your peace of mind from uncontrollable external events.'
    },
    {
      quote: 'Somewhere, something incredible is waiting to be known.',
      author: 'Carl Sagan',
      context: 'A call to lifelong curiosity and wonder from humanity\'s most beloved astronomer.'
    }
  ],

  'quiz-trivia': [
    {
      question: 'Which planet in our solar system has the shortest day?',
      options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
      correctIndex: 2,
      funFact: 'Jupiter rotates so rapidly on its axis that one complete day lasts just under 10 hours!'
    },
    {
      question: 'Which is the only mammal capable of sustained true powered flight?',
      options: ['Flying Squirrel', 'Sugar Glider', 'Bat', 'Colugo'],
      correctIndex: 2,
      funFact: 'While gliding mammals leap between trees, bats are the only mammals with genuine aerodynamic powered flight!'
    },
    {
      question: 'What is the rarest naturally occurring element in the Earth\'s crust?',
      options: ['Francium', 'Astatine', 'Platinum', 'Californium'],
      correctIndex: 1,
      funFact: 'Less than twenty-five grams of Astatine exist in the entire crust of the Earth at any single moment!'
    },
    {
      question: 'What is the only metal that remains in a liquid state at room temperature?',
      options: ['Gallium', 'Bromine', 'Mercury', 'Cesium'],
      correctIndex: 2,
      funFact: 'Mercury has a freezing point of minus thirty-eight degrees Fahrenheit, remaining liquid in everyday conditions!'
    }
  ],

  'would-you-rather': [
    {
      optionA: 'Travel 100 years into the future with no return ticket',
      optionB: 'Travel 100 years into the past with all your modern memories',
      voteA: 64,
      voteB: 36
    },
    {
      optionA: 'Speak every human language fluently',
      optionB: 'Communicate effortlessly with all animals on Earth',
      voteA: 58,
      voteB: 42
    },
    {
      optionA: 'Never need sleep again with zero physical or mental fatigue',
      optionB: 'Never suffer from any physical illness or injury ever again',
      voteA: 47,
      voteB: 53
    },
    {
      optionA: 'Rewind time by 10 seconds whenever you choose',
      optionB: 'Freeze time for 10 minutes once per day',
      voteA: 62,
      voteB: 38
    }
  ]
};

/**
 * Procedurally generates a structured script for any mode from a free-text topic or prompt.
 * Operates 100% offline using algorithmic heuristics.
 */
export function generateProceduralScript(mode, topic = '') {
  const cleanTopic = (topic || '').trim();
  const titleTopic = cleanTopic ? cleanTopic : 'The Hidden Secrets of the World';

  switch (mode) {
    case 'viral':
      return {
        hook: `Did you know this mind-blowing truth about ${titleTopic}?`,
        facts: [
          `Scientists recently discovered that ${titleTopic} operates in a way that completely defies classical expectations.`,
          `Researchers observed that under extreme conditions, ${titleTopic} behaves differently than anything previously documented.`,
          `Historical records show people suspected this anomaly centuries ago, but modern technology just proved it.`
        ],
        cta: `Follow for more unbelievable breakdowns on ${titleTopic}!`
      };

    case 'reddit-story':
      return {
        subreddit: 'r/confession',
        username: 'u/secret_discoverer',
        title: `The unexpected truth about ${titleTopic} that completely changed my life`,
        upvotes: '42.7k',
        comments: '2.9k',
        story: `I never planned on getting involved with ${titleTopic}. It all started during an ordinary evening when I stumbled across an obscure archive online.
What began as harmless curiosity quickly turned into an obsession as the patterns started lining up in ways I could not ignore.
Now that the truth has come to light, I finally understand why this story remained buried for so long.`
      };

    case 'explainer':
      return {
        title: `Top 3 Most Fascinating Facts About ${titleTopic}`,
        items: [
          { rank: 3, name: 'The Origin', line: `The foundational history of ${titleTopic} dates back far earlier than most textbooks acknowledge.` },
          { rank: 2, name: 'The Mechanism', line: `The underlying mechanics of ${titleTopic} produce an incredible chain reaction observed across nature.` },
          { rank: 1, name: 'The Breakthrough', line: `The most astonishing breakthrough reveals that ${titleTopic} holds the key to future technological frontiers.` }
        ]
      };

    case 'myth-vs-fact':
      return {
        myth: `Most people believe that ${titleTopic} is simple and completely understood.`,
        fact: `Cutting-edge scientific evidence proves that ${titleTopic} works through complex, unexpected mechanisms.`,
        explanation: `Extensive peer-reviewed research shows that our conventional assumptions about ${titleTopic} were based on outdated historical simplifications.`
      };

    case 'quote-motivational':
      return {
        quote: `Mastering ${titleTopic} begins not with dominating the external world, but with conquering your own inner discipline.`,
        author: 'Timeless Wisdom',
        context: `A philosophical reminder on understanding ${titleTopic} through patience, reflection, and quiet mastery.`
      };

    case 'quiz-trivia':
      return {
        question: `Which fundamental principle is most closely associated with ${titleTopic}?`,
        options: ['Thermal Dynamics', 'Quantum Entanglement', 'Iterative Evolution', 'Gravitational Resonance'],
        correctIndex: 2,
        funFact: `Extensive empirical studies have demonstrated that iterative evolution is central to understanding ${titleTopic}!`
      };

    case 'would-you-rather':
      return {
        optionA: `Gain complete master knowledge of ${titleTopic} overnight`,
        optionB: `Invent the revolutionary technology that transforms ${titleTopic} forever`,
        voteA: 55,
        voteB: 45
      };

    default:
      return AUTONOMOUS_TOPIC_BANKS['viral'][0];
  }
}

/**
 * Generates an autonomous script on its own.
 * Picks a curated high-retention script or synthesizes procedurally if a topic is specified.
 */
export function generateAutonomousScript(mode, topic = '') {
  const bank = AUTONOMOUS_TOPIC_BANKS[mode] || AUTONOMOUS_TOPIC_BANKS['viral'];

  // If no topic specified, pick a random curated script from the bank
  if (!topic || topic.trim() === '') {
    const idx = Math.floor(Math.random() * bank.length);
    return bank[idx];
  }

  // If a topic is specified, check if it closely matches any curated bank entry
  const lower = topic.toLowerCase();
  const match = bank.find(item => {
    const hay = JSON.stringify(item).toLowerCase();
    return hay.includes(lower);
  });

  if (match) return match;

  // Otherwise procedurally synthesize from the topic
  return generateProceduralScript(mode, topic);
}

/**
 * Unified Script Generation Orchestrator
 * Supports BYOK (Bring Your Own Key) for Google Gemini, with automatic fallback
 * to the autonomous in-browser generator.
 */
export async function generateScript({ mode, topic = '', geminiApiKey = '' } = {}) {
  const activeMode = mode || 'viral';

  // If user provided a Gemini API Key (BYOK), attempt AI generation
  if (geminiApiKey && geminiApiKey.trim()) {
    try {
      console.log(`[ScriptGen] Calling Gemini 1.5/2.0 API with BYOK key for mode "${activeMode}"...`);
      const aiResult = await generateScriptWithGemini(topic || activeMode, activeMode, geminiApiKey.trim());
      if (aiResult) {
        return {
          source: 'gemini',
          mode: activeMode,
          data: aiResult
        };
      }
    } catch (geminiErr) {
      console.warn('[ScriptGen] Gemini generation failed, falling back to autonomous engine:', geminiErr.message);
    }
  }

  // Autonomous / Offline Generation
  console.log(`[ScriptGen] Generating autonomous script for mode "${activeMode}"...`);
  const data = generateAutonomousScript(activeMode, topic);
  return {
    source: 'autonomous',
    mode: activeMode,
    data
  };
}
