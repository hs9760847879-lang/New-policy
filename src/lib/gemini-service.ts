// Gemini API service with fallback chain
// Models: Gemini 3 Flash → Gemini 2.5 Flash → Gemini 2.5 Flash Lite

export interface GeminiResponse {
  success: boolean;
  data?: string;
  model?: string;
  error?: string;
  attempts?: number;
}

// Model fallback chain
const MODEL_CHAIN = [
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// Policy types to extract
export const CANCELLATION_POLICIES = [
  'Cooling Off Period',
  'No Visa No Pay',
  'No Place No Pay',
  'Covid-19 Policy',
  'University Course Cancellation/Modification',
  'Early Termination by Students',
  'Delayed Arrivals & Travel Restrictions',
  'Replacement Tenant Found',
  'Deferring Studies',
  'University Intake Delayed',
  'No Questions Asked',
  'Extenuating Circumstances',
  'Other Cancellation Policies',
];

export const PAYMENT_POLICIES = [
  'Booking Deposit',
  'Security Deposit',
  'Payment Installment Plan',
  'Mode Of Payment',
  'Guarantor Requirement',
  'Fully Refundable Holding Fee',
  'Platform Fee',
  'Additional Fees',
];

export interface ExtractedPolicy {
  name: string;
  found: boolean;
  summary: string;
  details: string;
  conditions?: string[];
  refoundText?: string;
}

export interface ExtractionResult {
  cancellationPolicies: ExtractedPolicy[];
  paymentPolicies: ExtractedPolicy[];
  generalTerms?: string;
  companyName?: string;
  lastUpdated?: string;
  modelUsed: string;
  attempts: number;
}

// System prompt for policy extraction
const SYSTEM_PROMPT = `You are a specialized policy extraction AI for student accommodation websites. Your task is to analyze website content and extract specific cancellation and payment policies.

You must identify and extract information for these CANCELLATION POLICIES:
1. Cooling Off Period - Initial period where tenant can cancel without penalty
2. No Visa No Pay - Policy for visa rejection scenarios
3. No Place No Pay - Policy when university placement is not secured
4. Covid-19 Policy - Special provisions related to pandemic situations
5. University Course Cancellation/Modification - When courses are cancelled or modified
6. Early Termination by Students - Student-initiated early contract termination
7. Delayed Arrivals & Travel Restrictions - Late arrival or travel ban scenarios
8. Replacement Tenant Found - Policy when a new tenant replaces the current one
9. Deferring Studies - When student defers their studies
10. University Intake Delayed - When university start is postponed
11. No Questions Asked - Cancellation without providing reasons
12. Extenuating Circumstances - Special cases like illness, family emergencies
13. Other Cancellation Policies - Any other cancellation-related policies

And these PAYMENT POLICIES:
1. Booking Deposit - Initial deposit to secure accommodation
2. Security Deposit - Refundable deposit for damages
3. Payment Installment Plan - How payments can be split
4. Mode Of Payment - Accepted payment methods
5. Guarantor Requirement - Guarantor requirements and conditions
6. Fully Refundable Holding Fee - Holding fee refund conditions
7. Platform Fee - Any platform/service charges
8. Additional Fees - Other fees like utility, cleaning, etc.

For each policy found, provide:
- A clear summary (1-2 sentences)
- Detailed explanation with key terms
- Any conditions or timeframes mentioned
- The exact text from the website (if available)

If a policy is not explicitly mentioned, mark it as "Not Found" but look for related information.

IMPORTANT: Return ONLY valid JSON with no additional text or markdown formatting.`;

function createExtractionPrompt(content: string, url: string): string {
  return `Analyze the following website content from ${url} and extract all cancellation and payment policies.

WEBSITE CONTENT:
${content}

Return your response as a valid JSON object with this exact structure:
{
  "companyName": "Name of the accommodation provider",
  "lastUpdated": "Date of policy if mentioned, otherwise null",
  "generalTerms": "Brief overview of general terms if any",
  "cancellationPolicies": [
    {
      "name": "Policy name from the list",
      "found": true/false,
      "summary": "Brief 1-2 sentence summary",
      "details": "Detailed explanation with key terms and conditions",
      "conditions": ["condition1", "condition2"],
      "refoundText": "Exact text from website if available"
    }
  ],
  "paymentPolicies": [
    {
      "name": "Policy name from the list",
      "found": true/false,
      "summary": "Brief 1-2 sentence summary",
      "details": "Detailed explanation with key terms and conditions",
      "conditions": ["condition1", "condition2"],
      "refoundText": "Exact text from website if available"
    }
  ]
}

Ensure all 13 cancellation policies and 8 payment policies are included in the arrays, even if marked as not found.`;
}

async function callGeminiAPI(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            { text: systemPrompt }
          ]
        },
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return { success: true, data: data.candidates[0].content.parts[0].text };
    }

    if (data.promptFeedback?.blockReason) {
      return { success: false, error: `Blocked: ${data.promptFeedback.blockReason}` };
    }

    return { success: false, error: 'No response generated' };

  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function parseExtractionResult(text: string, model: string, attempts: number): ExtractionResult {
  // Try to extract JSON from the response
  let jsonData: any;

  try {
    // Remove potential markdown code blocks
    let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    jsonData = JSON.parse(cleanedText);
  } catch (e) {
    // If parsing fails, create a default structure
    console.error('[Gemini] Failed to parse JSON response:', e);
    jsonData = {};
  }

  // Ensure all policies are present
  const cancellationPolicies: ExtractedPolicy[] = CANCELLATION_POLICIES.map(name => {
    const found = jsonData.cancellationPolicies?.find((p: any) =>
      p.name?.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(p.name?.toLowerCase())
    );

    if (found) {
      return {
        name,
        found: found.found ?? true,
        summary: found.summary || '',
        details: found.details || '',
        conditions: found.conditions || [],
        refoundText: found.refoundText || found.foundText || '',
      };
    }

    return {
      name,
      found: false,
      summary: 'Not found in website content',
      details: '',
      conditions: [],
      refoundText: '',
    };
  });

  const paymentPolicies: ExtractedPolicy[] = PAYMENT_POLICIES.map(name => {
    const found = jsonData.paymentPolicies?.find((p: any) =>
      p.name?.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(p.name?.toLowerCase())
    );

    if (found) {
      return {
        name,
        found: found.found ?? true,
        summary: found.summary || '',
        details: found.details || '',
        conditions: found.conditions || [],
        refoundText: found.refoundText || found.foundText || '',
      };
    }

    return {
      name,
      found: false,
      summary: 'Not found in website content',
      details: '',
      conditions: [],
      refoundText: '',
    };
  });

  return {
    companyName: jsonData.companyName || 'Unknown',
    lastUpdated: jsonData.lastUpdated || undefined,
    generalTerms: jsonData.generalTerms || '',
    cancellationPolicies,
    paymentPolicies,
    modelUsed: model,
    attempts,
  };
}

export async function extractPoliciesWithFallback(
  apiKey: string,
  websiteContent: string,
  url: string,
  onProgress?: (model: string, attempt: number) => void
): Promise<ExtractionResult> {
  const prompt = createExtractionPrompt(websiteContent, url);
  let lastError: string = '';

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    const attempt = i + 1;

    console.log(`[Gemini] Attempt ${attempt}/${MODEL_CHAIN.length} with ${model}...`);

    if (onProgress) {
      onProgress(model, attempt);
    }

    const result = await callGeminiAPI(apiKey, model, prompt, SYSTEM_PROMPT);

    if (result.success && result.data) {
      console.log(`[Gemini] Successfully extracted policies using ${model}`);

      return parseExtractionResult(result.data, model, attempt);
    }

    lastError = result.error || 'Unknown error';
    console.log(`[Gemini] Failed with ${model}: ${lastError}`);

    // Wait before trying next model
    if (i < MODEL_CHAIN.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // All models failed
  return {
    cancellationPolicies: CANCELLATION_POLICIES.map(name => ({
      name,
      found: false,
      summary: 'Extraction failed',
      details: '',
      conditions: [],
      refoundText: '',
    })),
    paymentPolicies: PAYMENT_POLICIES.map(name => ({
      name,
      found: false,
      summary: 'Extraction failed',
      details: '',
      conditions: [],
      refoundText: '',
    })),
    modelUsed: 'none',
    attempts: MODEL_CHAIN.length,
    generalTerms: `Failed to extract policies: ${lastError}`,
  };
}

// Function to get available models
export function getModelChain(): string[] {
  return [...MODEL_CHAIN];
}
