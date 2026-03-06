import { chromium, Browser, Page, BrowserContext } from 'playwright';

// Stealth evasion techniques
const STEALTH_SCRIPT = `
// Override navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
});

// Override navigator.plugins
Object.defineProperty(navigator, 'plugins', {
  get: () => [1, 2, 3, 4, 5],
});

// Override navigator.languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en'],
});

// Override window.chrome
window.chrome = {
  runtime: {},
};

// Override permissions
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
  parameters.name === 'notifications' ?
    Promise.resolve({ state: Notification.permission }) :
    originalQuery(parameters)
);

// Override plugins length
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [
      {
        name: 'Chrome PDF Plugin',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
      },
      {
        name: 'Chrome PDF Viewer',
        description: '',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
      },
      {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
      },
    ];
    plugins.length = 3;
    return plugins;
  },
});

// Override WebGL vendor and renderer
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) {
    return 'Intel Inc.';
  }
  if (parameter === 37446) {
    return 'Intel Iris OpenGL Engine';
  }
  return getParameter.apply(this, [parameter]);
};

// Override iframe contentWindow
const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
  get: function() {
    const iframe = originalContentWindow.get.call(this);
    if (iframe) {
      try {
        Object.defineProperty(iframe.navigator, 'webdriver', {
          get: () => undefined,
        });
      } catch (e) {}
    }
    return iframe;
  },
});
`;

export interface ScrapeResult {
  success: boolean;
  content: string;
  title: string;
  url: string;
  links: string[];
  error?: string;
}

export interface PolicyPage {
  url: string;
  title: string;
  content: string;
  type: 'cancellation' | 'payment' | 'general';
}

// Keywords to find policy-related pages
const POLICY_KEYWORDS = [
  'cancellation', 'cancel', 'refund', 'policy', 'terms', 'conditions',
  'booking', 'payment', 'deposit', 'cooling off', 'no visa', 'no place',
  'covid', 'termination', 'withdrawal', 'guarantor', 'fee', 'installment'
];

// Priority links to check for policies
const PRIORITY_LINKS = [
  '/cancellation', '/cancel', '/refund', '/terms', '/booking-terms',
  '/terms-and-conditions', '/policies', '/payment', '/faqs', '/faq',
  '/student-terms', '/accommodation-terms', '/booking-policy'
];

async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Add additional headers
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  // Add stealth scripts
  await context.addInitScript(STEALTH_SCRIPT);

  return context;
}

async function extractPageContent(page: Page): Promise<{ title: string; content: string; links: string[] }> {
  const result = await page.evaluate(() => {
    // Remove unwanted elements
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'script', 'style', 'noscript',
      'iframe', 'svg', '.nav', '.header', '.footer', '.menu',
      '.sidebar', '.advertisement', '.ad', '.cookie-banner', '.popup',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
    ];

    const clone = document.body.cloneNode(true) as HTMLElement;
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extract main content
    const mainSelectors = ['main', 'article', '.content', '.main', '#content', '#main', '.policy-content'];
    let content = '';

    for (const selector of mainSelectors) {
      const el = clone.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > content.length) {
        content = el.textContent.trim();
      }
    }

    // Fallback to full body text if no main content found
    if (!content || content.length < 100) {
      content = clone.textContent?.trim() || '';
    }

    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Extract all links
    const links: string[] = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      const text = a.textContent?.toLowerCase() || '';
      if (href && (
        POLICY_KEYWORDS.some(kw => href.toLowerCase().includes(kw) || text.includes(kw)) ||
        href.includes('terms') || href.includes('policy') || href.includes('cancel') || href.includes('refund')
      )) {
        links.push(href);
      }
    });

    return {
      title: document.title,
      content,
      links: [...new Set(links)]
    };
  });

  return result;
}

function isPolicyRelated(link: string, text: string): boolean {
  const lowerLink = link.toLowerCase();
  const lowerText = text.toLowerCase();

  return POLICY_KEYWORDS.some(kw =>
    lowerLink.includes(kw) || lowerText.includes(kw)
  );
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  let browser: Browser | null = null;

  try {
    console.log(`[Scraper] Starting to scrape: ${url}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await createStealthContext(browser);
    const page = await context.newPage();

    // Set default timeout
    page.setDefaultTimeout(30000);

    console.log(`[Scraper] Navigating to ${url}...`);

    // Navigate with retry logic
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Wait for the page to stabilize
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        break;
      } catch (e) {
        lastError = e as Error;
        retries--;
        if (retries > 0) {
          console.log(`[Scraper] Retry ${4 - retries}/3...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    if (retries === 0 && lastError) {
      throw lastError;
    }

    // Extract content from main page
    const mainPageContent = await extractPageContent(page);
    console.log(`[Scraper] Main page content extracted: ${mainPageContent.content.length} chars`);

    // Collect all policy-related content
    const allContent: string[] = [mainPageContent.content];
    const allLinks: string[] = [...mainPageContent.links];

    // Find and visit policy-related pages
    const baseUrl = new URL(url);
    const visitedUrls = new Set<string>([url]);
    const policyUrls: string[] = [];

    // First, check for priority links
    for (const priorityLink of PRIORITY_LINKS) {
      try {
        const testUrl = new URL(priorityLink, baseUrl).href;
        if (!visitedUrls.has(testUrl)) {
          policyUrls.push(testUrl);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Add links found on the page
    for (const link of mainPageContent.links) {
      try {
        const absoluteUrl = new URL(link, baseUrl).href;
        if (!visitedUrls.has(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
          policyUrls.push(absoluteUrl);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Visit policy-related pages (limit to 5 pages to avoid too many requests)
    const pagesToVisit = policyUrls.slice(0, 5);
    console.log(`[Scraper] Found ${policyUrls.length} policy-related pages, visiting ${pagesToVisit.length}...`);

    for (const policyUrl of pagesToVisit) {
      if (visitedUrls.has(policyUrl)) continue;
      visitedUrls.add(policyUrl);

      try {
        console.log(`[Scraper] Visiting policy page: ${policyUrl}`);
        await page.goto(policyUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const pageContent = await extractPageContent(page);
        if (pageContent.content.length > 100) {
          allContent.push(`\n\n--- Page: ${policyUrl} ---\n${pageContent.content}`);
        }

        // Add new links
        for (const link of pageContent.links) {
          try {
            const absoluteUrl = new URL(link, baseUrl).href;
            if (!visitedUrls.has(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
              allLinks.push(absoluteUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      } catch (e) {
        console.log(`[Scraper] Failed to visit ${policyUrl}: ${(e as Error).message}`);
      }
    }

    const finalContent = allContent.join('\n');
    console.log(`[Scraper] Total content extracted: ${finalContent.length} chars from ${visitedUrls.size} pages`);

    await browser.close();
    browser = null;

    return {
      success: true,
      content: finalContent,
      title: mainPageContent.title,
      url: url,
      links: [...new Set(allLinks)],
    };

  } catch (error) {
    console.error(`[Scraper] Error: ${(error as Error).message}`);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      content: '',
      title: '',
      url: url,
      error: (error as Error).message,
    };
  }
}

// Function to scrape a specific page
export async function scrapePage(url: string): Promise<ScrapeResult> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await createStealthContext(browser);
    const page = await context.newPage();

    page.setDefaultTimeout(30000);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const pageContent = await extractPageContent(page);

    await browser.close();

    return {
      success: true,
      content: pageContent.content,
      title: pageContent.title,
      url: url,
      links: pageContent.links,
    };

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      content: '',
      title: '',
      url: url,
      error: (error as Error).message,
    };
  }
}
