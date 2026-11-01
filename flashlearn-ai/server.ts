import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'FlashLearn AI', time: new Date().toISOString() });
});

/**
 * Normalizes text for reliable matching by collapsing whitespace and punctuation
 */
function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['"“”‘’.,;:!?()\-—[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether textQuote actually exists in the submitted lesson text
 */
function isVerbatimInSource(quote: string, sourceText: string): boolean {
  if (!quote || typeof quote !== 'string') return false;
  const cleanSource = normalizeForComparison(sourceText);
  const cleanQuote = normalizeForComparison(quote);

  if (cleanQuote.length < 5) return false;
  if (cleanSource.includes(cleanQuote)) return true;

  // Check 80% word match for minor punctuation/whitespace variances
  const words = cleanQuote.split(' ').filter((w) => w.length > 2);
  if (words.length >= 3) {
    const matched = words.filter((w) => cleanSource.includes(w)).length;
    return matched / words.length >= 0.8;
  }
  return false;
}

/**
 * Validates a single flashcard against the currently submitted lesson text ONLY.
 * Works for any school subject (science, history, geography, English, math, etc.).
 */
function verifyCardAgainstSource(
  card: any,
  sourceText: string
): { isValid: boolean; issues: string[]; cleanedCard: any } {
  const issues: string[] = [];
  const cleanSource = normalizeForComparison(sourceText);
  const quote = typeof card.textQuote === 'string' ? card.textQuote.trim() : '';
  let answer = typeof card.answer === 'string' ? card.answer.trim() : '';
  let keyTakeaway = typeof card.keyTakeaway === 'string' ? card.keyTakeaway.trim() : '';
  const question = typeof card.question === 'string' ? card.question.trim() : '';
  const topic = typeof card.topic === 'string' && card.topic.trim() ? card.topic.trim() : 'Key Concept';

  if (!question || !answer || !quote) {
    return {
      isValid: false,
      issues: ['Missing question, answer, or supporting quote.'],
      cleanedCard: { ...card, isVerified: false },
    };
  }

  // 1. Supporting quotation must exist in the submitted lesson text
  const quoteInSource = isVerbatimInSource(quote, sourceText);
  if (!quoteInSource) {
    issues.push('Supporting sentence does not exist verbatim in the submitted lesson.');
  }

  // 2. Fact check: Check that significant words in the answer exist in the source text
  const normAns = normalizeForComparison(answer);
  const answerWords = normAns
    .split(' ')
    .filter((w) => w.length > 4 && !['because', 'however', 'therefore', 'between', 'another', 'called'].includes(w));

  if (answerWords.length > 0) {
    const supportedWords = answerWords.filter((w) => cleanSource.includes(w));
    const supportRatio = supportedWords.length / answerWords.length;
    if (supportRatio < 0.6) {
      issues.push('Answer contains concepts or claims not found in the submitted lesson.');
    }
  }

  const isValid = issues.length === 0 && quoteInSource;

  return {
    isValid,
    issues,
    cleanedCard: {
      id: card.id,
      topic,
      question,
      answer,
      keyTakeaway,
      textQuote: quote,
      isVerified: isValid,
      verificationIssue: isValid ? undefined : issues[0] || 'Not verified against your lesson',
    },
  };
}

// Flashcard Generation Endpoint for ANY subject
app.post('/api/generate-flashcards', async (req, res) => {
  try {
    const { lessonText } = req.body;

    if (!lessonText || typeof lessonText !== 'string' || lessonText.trim().length === 0) {
      return res.status(400).json({
        error: 'Please paste your lesson text before generating flashcards.',
      });
    }

    const currentLessonText = lessonText.trim();
    // 3. MINIMUM TEXT: A single short sentence or trivial fragment (< 30 chars or < 6 words)
    const wordCount = currentLessonText.split(/\s+/).filter(Boolean).length;
    if (currentLessonText.length < 30 || wordCount < 6) {
      return res.json({
        success: false,
        hasSufficientInfo: false,
        isValidated: false,
        message: 'The submitted text is too short to make at least 2 meaningful study cards. Please paste more of your lesson text from your textbook.',
        cards: [],
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'AI service configuration is missing. Please ensure GEMINI_API_KEY is configured.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
    const FALLBACK_MODEL = 'gemini-flash-latest';

    // 1 & 2 & 5: ANY SUBJECT, FLEXIBLE NUMBER OF CARDS (2 to 15), SHORT ANSWERS, STRICT GROUNDING
    const systemInstruction = `You are FlashLearn AI, an educational flashcard generator for middle school students in Classes 6–8.
You create clear, high-quality question-and-answer study cards from whatever lesson text the student provides, across ANY school subject (Science, History, Geography, English, Social Studies, Math concepts, Literature, etc.).

CORE RULES:
1. WORK WITH ANY TOPIC: Generate cards on the subject matter of the text provided (do NOT assume any specific subject or unit).
2. STRICT SOURCE GROUNDING: Use ONLY facts explicitly stated in the submitted lesson text. DO NOT add outside facts, historical events, scientific theories, examples, numbers, or details that are not in the text.
3. FLEXIBLE NUMBER OF CARDS:
   - Decide how many cards to create based on how much distinct, important information the text contains.
   - Roughly one card per key fact or concept.
   - Minimum 2 cards, maximum 15 cards.
   - Short text = fewer cards (e.g. 2–4 cards). Longer text = more cards (up to 15 cards).
   - Never invent or pad cards just to reach a number.
   - Do NOT create two cards that ask the same thing.
4. MINIMUM TEXT: If the text is too short to support at least 2 distinct, meaningful question-and-answer cards (e.g. a single short sentence), set hasSufficientInfo to false and explain kindly.
5. SHORT ANSWERS: Answers must be short (one or two sentences) and phrased close to the lesson's own wording.
6. SUPPORTING SENTENCE: For each card, textQuote MUST be the exact sentence or phrase copied verbatim from the submitted lesson that directly supports the answer.
7. SUITABLE FOR CLASSES 6–8: Clear, readable questions and key memory takeaways.`;

    const cardSchema = {
      type: Type.OBJECT,
      properties: {
        hasSufficientInfo: {
          type: Type.BOOLEAN,
          description: 'True if submitted text contains enough distinct facts to create at least 2 flashcards, false otherwise.',
        },
        insufficientReason: {
          type: Type.STRING,
          description: 'Friendly guidance to the student asking to paste more of the lesson if hasSufficientInfo is false.',
        },
        topicTitle: {
          type: Type.STRING,
          description: 'The overall topic or subject inferred from the lesson (e.g., "Water Cycle", "The Mughal Empire", "Parts of Speech", "Photosynthesis").',
        },
        cards: {
          type: Type.ARRAY,
          description: 'Between 2 and 15 distinct flashcards covering key facts in the lesson.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              topic: { type: Type.STRING, description: 'Specific subtopic or concept for this card' },
              textQuote: { type: Type.STRING, description: 'Exact sentence or phrase copied verbatim from the submitted lesson supporting the answer' },
              question: { type: Type.STRING, description: 'Clear question for Classes 6-8' },
              answer: { type: Type.STRING, description: 'One or two short sentences phrased close to the lesson text' },
              keyTakeaway: { type: Type.STRING, description: 'Brief key memory takeaway strictly from the text' },
            },
            required: ['id', 'topic', 'textQuote', 'question', 'answer', 'keyTakeaway'],
          },
        },
      },
      required: ['hasSufficientInfo', 'cards'],
    };

    const callModel = async (promptText: string, timeoutMs = 25000, modelName = PRIMARY_MODEL) => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timed out')), timeoutMs)
      );

      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          systemInstruction,
          temperature: 0.05,
          responseMimeType: 'application/json',
          responseSchema: cardSchema,
        },
      });

      return await Promise.race([generatePromise, timeoutPromise]);
    };

    const prompt = `Submitted lesson text:
---
${currentLessonText}
---

Generate between 2 and 15 flashcards (roughly one card per key fact), strictly using ONLY facts in this text.`;

    let response;
    try {
      response = await callModel(prompt, 22000, PRIMARY_MODEL);
    } catch (primaryErr: any) {
      console.warn('Primary model failed, trying fallback:', primaryErr?.message);
      try {
        response = await callModel(prompt, 22000, FALLBACK_MODEL);
      } catch (fallbackErr: any) {
        if (primaryErr?.message?.includes('timed out') || fallbackErr?.message?.includes('timed out')) {
          return res.status(504).json({
            error: 'Flashcard generation took longer than expected. Please try again with your lesson text.',
          });
        }
        return res.status(503).json({
          error: 'The AI study service is currently busy. Please try clicking Generate Flashcards again in a moment.',
        });
      }
    }

    const rawText = response?.text;
    if (!rawText) {
      return res.status(502).json({ error: 'The AI model returned an empty response. Please try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (parseErr) {
      return res.status(502).json({ error: 'Unable to parse the AI flashcard response. Please try again.' });
    }

    if (!parsed || typeof parsed.hasSufficientInfo !== 'boolean') {
      return res.status(502).json({ error: 'Received unexpected format from AI model. Please try again.' });
    }

    // 3. MINIMUM TEXT CHECK (< 2 cards)
    if (!parsed.hasSufficientInfo || !Array.isArray(parsed.cards) || parsed.cards.length < 2) {
      return res.json({
        success: false,
        hasSufficientInfo: false,
        isValidated: false,
        message:
          parsed.insufficientReason ||
          'The submitted text is too short to make at least 2 meaningful study cards. Please paste more of your lesson text from your textbook.',
        cards: [],
      });
    }

    // 6. LONG TEXT & CAPPING AT 15 CARDS
    let candidateCards = parsed.cards;
    let isCapped = false;
    let cappedNote: string | undefined = undefined;

    if (candidateCards.length > 15 || (wordCount > 350 && candidateCards.length >= 15)) {
      isCapped = true;
      cappedNote = 'Your lesson was long, so we created the 15 most important cards. Paste the next section to make more.';
      candidateCards = candidateCards.slice(0, 15);
    }

    // Re-index card IDs cleanly from 1 to N
    candidateCards = candidateCards.map((c: any, index: number) => ({
      ...c,
      id: index + 1,
    }));

    // 4. VERIFICATION STEP: Check each card against the currently submitted lesson text ONLY
    let verifiedCards: any[] = [];
    const failedIndices: number[] = [];

    for (let i = 0; i < candidateCards.length; i++) {
      const card = candidateCards[i];
      const check = verifyCardAgainstSource(card, currentLessonText);
      verifiedCards.push(check.cleanedCard);
      if (!check.isValid) {
        failedIndices.push(i);
      }
    }

    // 4. REGENERATE FAILED CARDS ONCE
    if (failedIndices.length > 0) {
      console.log(`Regenerating ${failedIndices.length} card(s) that failed verification...`);
      const failedDescriptions = failedIndices
        .map((idx) => {
          const c = verifiedCards[idx];
          return `Card ${c.id}: Question was "${c.question}". Reason: ${c.verificationIssue || 'Answer had details not found in submitted lesson.'}`;
        })
        .join('\n');

      const regenPrompt = `The following card(s) failed strict verification against the submitted lesson:
${failedDescriptions}

Submitted Lesson Text:
---
${currentLessonText}
---

Regenerate these card(s). RULES:
- Use ONLY facts stated in the submitted lesson text.
- Answer must be short (1-2 sentences) matching lesson wording.
- textQuote MUST be an exact sentence copied verbatim from the submitted lesson text.`;

      try {
        const regenRes = await callModel(regenPrompt, 6000, PRIMARY_MODEL);
        if (regenRes?.text) {
          const regenParsed = JSON.parse(regenRes.text.trim());
          if (Array.isArray(regenParsed.cards)) {
            for (const rCard of regenParsed.cards) {
              const targetIdx = failedIndices.find((idx) => verifiedCards[idx].id === rCard.id) ?? failedIndices[0];
              if (targetIdx !== undefined) {
                const recheck = verifyCardAgainstSource(rCard, currentLessonText);
                verifiedCards[targetIdx] = recheck.cleanedCard;
              }
            }
          }
        }
      } catch (regenErr) {
        console.warn('Regeneration attempt timed out or failed; keeping honest unverified labels:', regenErr);
      }
    }

    // 4 & 5. HONEST NOTICE ADAPTED TO ACTUAL CARD COUNT N
    const totalCount = verifiedCards.length;
    const verifiedCount = verifiedCards.filter((c) => c.isVerified === true).length;
    const allPassed = verifiedCount === totalCount;

    let verificationNotice = '';
    let verificationStatus: 'all_verified' | 'partially_verified' | 'unavailable' = 'all_verified';

    if (allPassed) {
      verificationNotice = `All ${totalCount} cards verified against your lesson`;
      verificationStatus = 'all_verified';
    } else {
      verificationNotice = `${verifiedCount} of ${totalCount} cards verified against your lesson`;
      verificationStatus = 'partially_verified';
    }

    const topicTitle = parsed.topicTitle?.trim() || 'Lesson';

    return res.json({
      success: true,
      hasSufficientInfo: true,
      topicTitle,
      isValidated: allPassed,
      verifiedCount,
      totalCount,
      verificationStatus,
      verificationNotice,
      validationNotes: verificationNotice,
      isCapped,
      cappedNote,
      cards: verifiedCards,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating flashcards:', error);
    const msg = error?.message || 'An unexpected error occurred while communicating with the AI model.';
    return res.status(500).json({
      error: `Could not generate flashcards: ${msg}`,
    });
  }
});

async function start() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FlashLearn AI server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Server startup error:', err);
});
