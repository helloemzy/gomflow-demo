import OpenAI from 'openai';
import { supabase } from '@/lib/supabase/client';

// Types for localization
export interface LocalizationRequest {
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
  platform: string;
  contentType: 'text' | 'hashtags' | 'caption' | 'description';
  culturalContext?: 'formal' | 'casual' | 'youthful' | 'professional';
  preserveEmojis?: boolean;
  preserveHashtags?: boolean;
  preserveMentions?: boolean;
}

export interface LocalizationResponse {
  originalContent: string;
  localizedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  culturalAdaptations: string[];
  qualityScore: number;
  confidence: number;
  suggestions: string[];
}

export interface CulturalContext {
  language: string;
  country: string;
  category: string;
  contextKey: string;
  contextValue: string;
  usageExamples: string[];
  relevanceScore: number;
}

export interface LanguageProfile {
  code: string;
  name: string;
  nativeName: string;
  countries: string[];
  cultural: {
    formalityLevel: 'high' | 'medium' | 'low';
    emojiesUsage: 'frequent' | 'moderate' | 'rare';
    hashtagStyle: 'english' | 'native' | 'mixed';
    honorifics: boolean;
    directness: 'direct' | 'indirect';
  };
  kpopTerminology: Record<string, string>;
  commonPhrases: Record<string, string>;
  socialMediaStyle: {
    preferredLength: 'short' | 'medium' | 'long';
    punctuationStyle: 'minimal' | 'moderate' | 'expressive';
    capitalization: 'standard' | 'lowercase' | 'emphasis';
  };
}

// Language profiles for Southeast Asian markets
const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    countries: ['US', 'UK', 'AU', 'CA', 'PH', 'SG', 'MY'],
    cultural: {
      formalityLevel: 'medium',
      emojiesUsage: 'moderate',
      hashtagStyle: 'english',
      honorifics: false,
      directness: 'direct',
    },
    kpopTerminology: {
      'bias': 'favorite member',
      'stan': 'support/love',
      'comeback': 'new release',
      'era': 'promotional period',
      'visual': 'most attractive member',
    },
    commonPhrases: {
      'group_order_open': 'Group order is now open!',
      'deadline_soon': 'Deadline approaching!',
      'payment_reminder': 'Payment reminder',
      'shipping_update': 'Shipping update',
      'thank_you': 'Thank you so much!',
    },
    socialMediaStyle: {
      preferredLength: 'medium',
      punctuationStyle: 'moderate',
      capitalization: 'standard',
    },
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    countries: ['KR'],
    cultural: {
      formalityLevel: 'high',
      emojiesUsage: 'frequent',
      hashtagStyle: 'mixed',
      honorifics: true,
      directness: 'indirect',
    },
    kpopTerminology: {
      'bias': '최애',
      'stan': '덕질하다',
      'comeback': '컴백',
      'era': '활동기',
      'visual': '비주얼',
    },
    commonPhrases: {
      'group_order_open': '공동구매 시작합니다!',
      'deadline_soon': '마감 임박!',
      'payment_reminder': '입금 확인 부탁드려요',
      'shipping_update': '배송 업데이트',
      'thank_you': '감사합니다!',
    },
    socialMediaStyle: {
      preferredLength: 'short',
      punctuationStyle: 'expressive',
      capitalization: 'standard',
    },
  },
  tl: {
    code: 'tl',
    name: 'Tagalog',
    nativeName: 'Tagalog',
    countries: ['PH'],
    cultural: {
      formalityLevel: 'medium',
      emojiesUsage: 'frequent',
      hashtagStyle: 'mixed',
      honorifics: false,
      directness: 'direct',
    },
    kpopTerminology: {
      'bias': 'paboritong member',
      'stan': 'suportahan',
      'comeback': 'bagong release',
      'era': 'era/panahon',
      'visual': 'pinakamaganda/gwapo',
    },
    commonPhrases: {
      'group_order_open': 'Bukas na ang group order!',
      'deadline_soon': 'Malapit na deadline!',
      'payment_reminder': 'Pa-remind lang sa payment',
      'shipping_update': 'Shipping update',
      'thank_you': 'Salamat talaga!',
    },
    socialMediaStyle: {
      preferredLength: 'medium',
      punctuationStyle: 'expressive',
      capitalization: 'standard',
    },
  },
  id: {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    countries: ['ID'],
    cultural: {
      formalityLevel: 'medium',
      emojiesUsage: 'moderate',
      hashtagStyle: 'mixed',
      honorifics: false,
      directness: 'indirect',
    },
    kpopTerminology: {
      'bias': 'member favorit',
      'stan': 'dukung/cinta',
      'comeback': 'comeback/rilis baru',
      'era': 'era',
      'visual': 'paling cantik/ganteng',
    },
    commonPhrases: {
      'group_order_open': 'Group order dibuka!',
      'deadline_soon': 'Deadline segera!',
      'payment_reminder': 'Reminder pembayaran',
      'shipping_update': 'Update pengiriman',
      'thank_you': 'Terima kasih banyak!',
    },
    socialMediaStyle: {
      preferredLength: 'medium',
      punctuationStyle: 'moderate',
      capitalization: 'standard',
    },
  },
  th: {
    code: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    countries: ['TH'],
    cultural: {
      formalityLevel: 'high',
      emojiesUsage: 'frequent',
      hashtagStyle: 'mixed',
      honorifics: true,
      directness: 'indirect',
    },
    kpopTerminology: {
      'bias': 'เมมเบอร์ที่ชอบที่สุด',
      'stan': 'เป็นแฟน',
      'comeback': 'คัมแบ็ค',
      'era': 'ยุค',
      'visual': 'หน้าตาดีที่สุด',
    },
    commonPhrases: {
      'group_order_open': 'เปิดกรุ๊ปออเดอร์แล้ว!',
      'deadline_soon': 'ใกล้ดีดไลน์แล้ว!',
      'payment_reminder': 'รีไมนด์ชำระเงิน',
      'shipping_update': 'อัพเดทการส่ง',
      'thank_you': 'ขอบคุณมากค่ะ!',
    },
    socialMediaStyle: {
      preferredLength: 'short',
      punctuationStyle: 'expressive',
      capitalization: 'standard',
    },
  },
  ms: {
    code: 'ms',
    name: 'Malay',
    nativeName: 'Bahasa Melayu',
    countries: ['MY', 'SG', 'BN'],
    cultural: {
      formalityLevel: 'medium',
      emojiesUsage: 'moderate',
      hashtagStyle: 'mixed',
      honorifics: false,
      directness: 'indirect',
    },
    kpopTerminology: {
      'bias': 'member kegemaran',
      'stan': 'sokong/cinta',
      'comeback': 'comeback/keluaran baru',
      'era': 'era',
      'visual': 'paling cantik/kacak',
    },
    commonPhrases: {
      'group_order_open': 'Group order dibuka!',
      'deadline_soon': 'Deadline hampir!',
      'payment_reminder': 'Peringatan pembayaran',
      'shipping_update': 'Kemaskini penghantaran',
      'thank_you': 'Terima kasih banyak!',
    },
    socialMediaStyle: {
      preferredLength: 'medium',
      punctuationStyle: 'moderate',
      capitalization: 'standard',
    },
  },
};

class ContentLocalizer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Localize content to target language with cultural adaptation
   */
  async localizeContent(request: LocalizationRequest): Promise<LocalizationResponse> {
    try {
      const sourceProfile = LANGUAGE_PROFILES[request.sourceLanguage];
      const targetProfile = LANGUAGE_PROFILES[request.targetLanguage];

      if (!targetProfile) {
        throw new Error(`Unsupported target language: ${request.targetLanguage}`);
      }

      // Get cultural context for target language
      const culturalContext = await this.getCulturalContext(request.targetLanguage);

      // Build localization prompt
      const localizationPrompt = await this.buildLocalizationPrompt(
        request,
        sourceProfile,
        targetProfile,
        culturalContext
      );

      // Perform AI-powered localization
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: localizationPrompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No localization response received');
      }

      const parsed = JSON.parse(response);

      // Post-process the localized content
      const postProcessed = await this.postProcessLocalization(
        parsed.localizedContent,
        request,
        targetProfile
      );

      // Assess localization quality
      const qualityAssessment = await this.assessLocalizationQuality(
        request.content,
        postProcessed,
        request.targetLanguage
      );

      return {
        originalContent: request.content,
        localizedContent: postProcessed,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        culturalAdaptations: parsed.culturalAdaptations || [],
        qualityScore: qualityAssessment.score,
        confidence: qualityAssessment.confidence,
        suggestions: parsed.suggestions || [],
      };

    } catch (error) {
      console.error('Error localizing content:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive localization prompt
   */
  private async buildLocalizationPrompt(
    request: LocalizationRequest,
    sourceProfile: LanguageProfile | undefined,
    targetProfile: LanguageProfile,
    culturalContext: CulturalContext[]
  ): Promise<string> {
    const contextString = culturalContext
      .map(ctx => `${ctx.contextKey}: ${ctx.contextValue}`)
      .join('\n');

    return `Localize this ${request.platform} ${request.contentType} from ${request.sourceLanguage} to ${targetProfile.nativeName}:

Original content: "${request.content}"

Target language: ${targetProfile.name} (${targetProfile.nativeName})
Target countries: ${targetProfile.countries.join(', ')}
Platform: ${request.platform}
Content type: ${request.contentType}
Cultural context: ${request.culturalContext || 'casual'}

Language characteristics:
- Formality level: ${targetProfile.cultural.formalityLevel}
- Emoji usage: ${targetProfile.cultural.emojiesUsage}
- Hashtag style: ${targetProfile.cultural.hashtagStyle}
- Uses honorifics: ${targetProfile.cultural.honorifics}
- Communication style: ${targetProfile.cultural.directness}

Social media style:
- Preferred length: ${targetProfile.socialMediaStyle.preferredLength}
- Punctuation: ${targetProfile.socialMediaStyle.punctuationStyle}
- Capitalization: ${targetProfile.socialMediaStyle.capitalization}

K-pop terminology in ${targetProfile.name}:
${Object.entries(targetProfile.kpopTerminology).map(([en, local]) => `${en} → ${local}`).join('\n')}

Common phrases in ${targetProfile.name}:
${Object.entries(targetProfile.commonPhrases).map(([key, phrase]) => `${key}: ${phrase}`).join('\n')}

Cultural context for ${targetProfile.name}:
${contextString}

Preserve settings:
- Emojis: ${request.preserveEmojis !== false}
- Hashtags: ${request.preserveHashtags !== false}
- Mentions: ${request.preserveMentions !== false}

Requirements:
1. Translate accurately while maintaining meaning
2. Adapt to cultural nuances and communication style
3. Use appropriate K-pop terminology
4. Match social media conventions for ${request.platform}
5. Preserve specified elements (emojis, hashtags, mentions)
6. Ensure natural, native-like expression
7. Consider target audience (K-pop fans in ${targetProfile.countries.join('/')})

Return JSON:
{
  "localizedContent": "Translated and culturally adapted content",
  "culturalAdaptations": ["adaptation1", "adaptation2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "reasoning": "Brief explanation of choices made"
}`;
  }

  /**
   * Get cultural context from database
   */
  private async getCulturalContext(language: string): Promise<CulturalContext[]> {
    const { data, error } = await supabase
      .from('ai_cultural_context')
      .select('*')
      .eq('language', language)
      .eq('is_active', true)
      .order('relevance_score', { ascending: false })
      .limit(15);

    if (error) {
      console.error('Error fetching cultural context:', error);
      return [];
    }

    return data.map(item => ({
      language: item.language,
      country: item.country,
      category: item.cultural_category,
      contextKey: item.context_key,
      contextValue: item.context_value,
      usageExamples: item.usage_examples || [],
      relevanceScore: item.relevance_score,
    }));
  }

  /**
   * Post-process localized content
   */
  private async postProcessLocalization(
    content: string,
    request: LocalizationRequest,
    targetProfile: LanguageProfile
  ): Promise<string> {
    let processed = content;

    // Apply platform-specific formatting
    if (request.platform === 'twitter' && processed.length > 280) {
      processed = processed.substring(0, 277) + '...';
    }

    // Adjust punctuation style
    if (targetProfile.socialMediaStyle.punctuationStyle === 'expressive') {
      processed = processed.replace(/\!+/g, '!!').replace(/\?+/g, '??');
    } else if (targetProfile.socialMediaStyle.punctuationStyle === 'minimal') {
      processed = processed.replace(/[!]{2,}/g, '!').replace(/[?]{2,}/g, '?');
    }

    // Apply capitalization style
    if (targetProfile.socialMediaStyle.capitalization === 'lowercase') {
      processed = processed.toLowerCase();
    }

    return processed;
  }

  /**
   * Assess localization quality
   */
  private async assessLocalizationQuality(
    original: string,
    localized: string,
    targetLanguage: string
  ): Promise<{ score: number; confidence: number }> {
    const assessmentPrompt = `Assess the quality of this ${targetLanguage} localization:

Original: "${original}"
Localized: "${localized}"

Rate the localization quality considering:
1. Accuracy of translation
2. Cultural appropriateness
3. Natural expression in target language
4. Preservation of original meaning
5. K-pop terminology usage
6. Social media style

Return JSON:
{
  "score": 8.5,
  "confidence": 0.9,
  "reasoning": "Brief explanation"
}

Score: 1-10 (quality rating)
Confidence: 0-1 (how certain you are)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: assessmentPrompt }],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const assessment = JSON.parse(response);
        return {
          score: assessment.score || 7.5,
          confidence: assessment.confidence || 0.8,
        };
      }
    } catch (error) {
      console.error('Error assessing localization quality:', error);
    }

    return { score: 7.5, confidence: 0.8 };
  }

  /**
   * Batch localize content to multiple languages
   */
  async batchLocalize(
    content: string,
    sourceLanguage: string,
    targetLanguages: string[],
    platform: string,
    contentType: 'text' | 'hashtags' | 'caption' | 'description' = 'text'
  ): Promise<Record<string, LocalizationResponse>> {
    const results: Record<string, LocalizationResponse> = {};

    // Process localizations in parallel (but limit to avoid rate limits)
    const batchSize = 3;
    for (let i = 0; i < targetLanguages.length; i += batchSize) {
      const batch = targetLanguages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (lang) => {
        try {
          const result = await this.localizeContent({
            content,
            sourceLanguage,
            targetLanguage: lang,
            platform,
            contentType,
          });
          return { lang, result };
        } catch (error) {
          console.error(`Error localizing to ${lang}:`, error);
          return { lang, result: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ lang, result }) => {
        if (result) {
          results[lang] = result;
        }
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < targetLanguages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get language-specific hashtags
   */
  async getLocalizedHashtags(
    baseHashtags: string[],
    targetLanguage: string,
    contentCategory: string = 'general'
  ): Promise<string[]> {
    const targetProfile = LANGUAGE_PROFILES[targetLanguage];
    if (!targetProfile) {
      return baseHashtags;
    }

    const prompt = `Convert these hashtags to ${targetProfile.nativeName} for ${contentCategory} K-pop content:

Base hashtags: ${baseHashtags.join(', ')}

Requirements:
- Keep effective English hashtags for global reach
- Add ${targetProfile.name} equivalents where appropriate
- Follow ${targetProfile.cultural.hashtagStyle} style
- Consider K-pop fan culture in ${targetProfile.countries.join('/')}
- Maintain discoverability

Return JSON array: ["hashtag1", "hashtag2", ...]`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const parsed = JSON.parse(response);
        return Array.isArray(parsed.hashtags) ? parsed.hashtags : 
               Array.isArray(parsed) ? parsed : baseHashtags;
      }
    } catch (error) {
      console.error('Error localizing hashtags:', error);
    }

    return baseHashtags;
  }

  /**
   * Get available languages for localization
   */
  getAvailableLanguages(): LanguageProfile[] {
    return Object.values(LANGUAGE_PROFILES);
  }

  /**
   * Get language profile by code
   */
  getLanguageProfile(languageCode: string): LanguageProfile | null {
    return LANGUAGE_PROFILES[languageCode] || null;
  }

  /**
   * Detect language of content
   */
  async detectLanguage(content: string): Promise<{
    language: string;
    confidence: number;
    alternatives: Array<{ language: string; confidence: number }>;
  }> {
    const detectionPrompt = `Detect the language of this text:
"${content}"

Consider:
- K-pop fan terminology
- Mixed language usage common in Southeast Asia
- Social media abbreviations

Return JSON:
{
  "language": "en",
  "confidence": 0.95,
  "alternatives": [
    {"language": "tl", "confidence": 0.3},
    {"language": "id", "confidence": 0.1}
  ]
}

Use language codes: en, ko, tl, id, th, ms`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: detectionPrompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const detection = JSON.parse(response);
        return {
          language: detection.language || 'en',
          confidence: detection.confidence || 0.8,
          alternatives: detection.alternatives || [],
        };
      }
    } catch (error) {
      console.error('Error detecting language:', error);
    }

    // Default to English with medium confidence
    return {
      language: 'en',
      confidence: 0.6,
      alternatives: [],
    };
  }

  /**
   * Validate localized content
   */
  async validateLocalization(
    original: string,
    localized: string,
    targetLanguage: string
  ): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const validationPrompt = `Validate this ${targetLanguage} localization:

Original: "${original}"
Localized: "${localized}"

Check for:
1. Translation accuracy
2. Cultural appropriateness
3. Grammar and spelling
4. Natural expression
5. K-pop terminology usage
6. Potential offensive content

Return JSON:
{
  "isValid": true,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: validationPrompt }],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const validation = JSON.parse(response);
        return {
          isValid: validation.isValid !== false,
          issues: validation.issues || [],
          suggestions: validation.suggestions || [],
        };
      }
    } catch (error) {
      console.error('Error validating localization:', error);
    }

    return {
      isValid: true,
      issues: [],
      suggestions: [],
    };
  }
}

// Export singleton instance
export const contentLocalizer = new ContentLocalizer();

// Export types and profiles
export { LANGUAGE_PROFILES };
export type {
  LocalizationRequest,
  LocalizationResponse,
  CulturalContext,
  LanguageProfile,
};