import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { extractPoliciesWithFallback, ExtractionResult } from '@/lib/gemini-service';

export interface ExtractionRequest {
  url: string;
  apiKey: string;
}

export interface ExtractionResponse {
  success: boolean;
  result?: ExtractionResult;
  scrapedContent?: {
    title: string;
    contentLength: number;
    pagesScraped: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ExtractionResponse>> {
  try {
    const body = await request.json() as ExtractionRequest;
    const { url, apiKey } = body;

    // Validate input
    if (!url || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'URL and API key are required',
      }, { status: 400 });
    }

    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format',
      }, { status: 400 });
    }

    console.log(`[API] Starting extraction for: ${validUrl.href}`);

    // Step 1: Scrape the website
    console.log('[API] Step 1: Scraping website...');
    const scrapeResult = await scrapeWebsite(validUrl.href);

    if (!scrapeResult.success || !scrapeResult.content) {
      return NextResponse.json({
        success: false,
        error: `Failed to scrape website: ${scrapeResult.error || 'No content found'}`,
      }, { status: 500 });
    }

    console.log(`[API] Scraped ${scrapeResult.content.length} characters from website`);

    // Step 2: Extract policies using Gemini with fallback
    console.log('[API] Step 2: Extracting policies with Gemini...');
    const extractionResult = await extractPoliciesWithFallback(
      apiKey,
      scrapeResult.content,
      validUrl.href
    );

    console.log(`[API] Extraction complete using model: ${extractionResult.modelUsed}`);

    return NextResponse.json({
      success: true,
      result: extractionResult,
      scrapedContent: {
        title: scrapeResult.title,
        contentLength: scrapeResult.content.length,
        pagesScraped: 1, // Could be expanded to track actual pages
      },
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message || 'An unexpected error occurred',
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'Policy Extraction API',
    endpoints: {
      'POST /api/extract-policies': 'Extract policies from a website',
    },
  });
}
