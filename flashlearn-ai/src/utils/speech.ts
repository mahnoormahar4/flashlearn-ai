/**
 * Utility functions for language detection, right-to-left (RTL) detection,
 * and browser SpeechSynthesis voice selection.
 */

// Common RTL Unicode script ranges (Arabic, Urdu, Hebrew, Persian, etc.)
const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;

/**
 * Returns true if the text contains right-to-left characters (such as Urdu or Arabic).
 */
export function isRTL(text?: string | null): boolean {
  if (!text) return false;
  return RTL_REGEX.test(text);
}

export interface DetectedLanguage {
  code: string;
  bcp47: string;
  displayName: string;
  isRtl: boolean;
}

/**
 * Detects the language of the provided card text.
 */
export function detectLanguage(text?: string | null): DetectedLanguage {
  if (!text) {
    return { code: 'en', bcp47: 'en-US', displayName: 'English', isRtl: false };
  }

  // Urdu / Arabic script
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) {
    return { code: 'ur', bcp47: 'ur-PK', displayName: 'Urdu', isRtl: true };
  }

  // Hebrew
  if (/[\u0590-\u05FF\uFB1D-\uFB4F]/.test(text)) {
    return { code: 'he', bcp47: 'he-IL', displayName: 'Hebrew', isRtl: true };
  }

  // Hindi (Devanagari)
  if (/[\u0900-\u097F]/.test(text)) {
    return { code: 'hi', bcp47: 'hi-IN', displayName: 'Hindi', isRtl: false };
  }

  // Spanish
  if (/[áéíóúüñ¿¡]/i.test(text)) {
    return { code: 'es', bcp47: 'es-ES', displayName: 'Spanish', isRtl: false };
  }

  // French
  if (/[çàâêîôûëïœæ]/i.test(text)) {
    return { code: 'fr', bcp47: 'fr-FR', displayName: 'French', isRtl: false };
  }

  // German
  if (/[äöüß]/i.test(text)) {
    return { code: 'de', bcp47: 'de-DE', displayName: 'German', isRtl: false };
  }

  // Default to English
  return { code: 'en', bcp47: 'en-US', displayName: 'English', isRtl: false };
}

/**
 * Finds a matching voice from the browser's available voices for the detected language.
 * Returns null if no matching voice exists for that language.
 */
export function findMatchingVoice(
  voices: SpeechSynthesisVoice[],
  detected: DetectedLanguage
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const targetCode = detected.code.toLowerCase();
  const targetBcp47 = detected.bcp47.toLowerCase();

  // 1. Exact match on BCP-47 tag (e.g. 'ur-pk', 'ur-in', 'en-us')
  const exactMatch = voices.find((v) => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang === targetBcp47;
  });
  if (exactMatch) return exactMatch;

  // 2. Prefix match on language code (e.g. 'ur-IN' for 'ur', or 'en-GB' for 'en')
  const prefixMatch = voices.find((v) => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang.startsWith(targetCode + '-') || vLang === targetCode;
  });
  if (prefixMatch) return prefixMatch;

  // 3. Name match on voice name (e.g. "Urdu Pakistan" or "Microsoft English")
  const nameMatch = voices.find((v) =>
    v.name.toLowerCase().includes(detected.displayName.toLowerCase())
  );
  if (nameMatch) return nameMatch;

  return null;
}
