import { GoogleGenAI } from "@google/genai";
import { CrawledPage, SitemapEntry, RobotsTxtAnalysis } from '../types';

// Use a CORS proxy to fetch content directly from websites, bypassing browser security limitations.
// Switched to corsproxy.io for better reliability.
const PROXY_URL = 'https://corsproxy.io/?';

/**
 * Fetches the content of a URL using a CORS proxy, with built-in retries and timeout.
 * This makes the crawler more resilient to transient network or proxy issues.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the text content of the page.
 */
async function fetchWithProxy(
    url: string, 
    retries = 3, 
    timeout = 30000 // 30 seconds
): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            const decodedUrl = decodeURIComponent(url);
            const response = await fetch(`${PROXY_URL}${encodeURIComponent(decodedUrl)}`, {
                signal: controller.signal
            });
            
            clearTimeout(id);

            if (!response.ok) {
                throw new Error(`Proxy request failed with status ${response.status} for ${url}`);
            }
            return await response.text();
        } catch (error) {
            console.warn(`Attempt ${i + 1} of ${retries} failed for ${url}:`, error.message);
            if (i === retries - 1) {
                console.error(`Final attempt failed for ${url}:`, error);
                throw new Error(`Failed to fetch content for ${url} after ${retries} attempts. The site might be blocking the CORS proxy, or the proxy service may be temporarily unavailable. Please try again later.`);
            }
            // Wait before retrying (e.g., 500ms, 1000ms, 1500ms)
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
    }
    // This line should be theoretically unreachable if retries > 0
    throw new Error(`Failed to fetch content for ${url}.`);
}


/**
 * Extracts a JSON string from a larger text block.
 */
function extractJson(text: string): string {
    const firstBracket = text.indexOf('{');
    const firstSquare = text.indexOf('[');
    
    let startIndex = -1;
    if (firstBracket === -1 && firstSquare === -1) return "";
    if (firstBracket === -1) startIndex = firstSquare;
    else if (firstSquare === -1) startIndex = firstBracket;
    else startIndex = Math.min(firstBracket, firstSquare);

    const lastBracket = text.lastIndexOf('}');
    const lastSquare = text.lastIndexOf(']');
    
    let endIndex = Math.max(lastBracket, lastSquare);
    
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return "";
    }

    return text.substring(startIndex, endIndex + 1);
}

/**
 * Performs a live crawl of a website to discover internal URLs. This is a real crawl, not a simulation.
 * @param startUrl The starting URL for the crawl.
 * @param crawlDepth The maximum depth of links to follow.
 * @returns A promise that resolves to an array of unique internal URLs found.
 */
export const discoverUrlsToCrawl = async (startUrl: string, crawlDepth: number): Promise<string[]> => {
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();
    const foundUrls = new Set<string>();
    const baseUrl = new URL(startUrl);

    visited.add(startUrl);
    foundUrls.add(startUrl);

    let i = 0;
    while (i < queue.length) {
        const { url, depth } = queue[i];
        i++;

        if (depth >= crawlDepth) {
            continue;
        }

        try {
            const html = await fetchWithProxy(url);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href]');

            links.forEach(link => {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) {
                    return;
                }

                try {
                    const urlObject = new URL(href, url);
                    
                    // Only crawl HTTP/HTTPS links
                    if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
                        return;
                    }

                    const absoluteUrl = urlObject.href.split('#')[0]; // Remove fragment

                    if (urlObject.hostname === baseUrl.hostname && !visited.has(absoluteUrl)) {
                        visited.add(absoluteUrl);
                        foundUrls.add(absoluteUrl);
                        queue.push({ url: absoluteUrl, depth: depth + 1 });
                    }
                } catch (e) {
                    // Ignore invalid URLs (e.g., javascript:void(0))
                    console.warn(`Could not parse link href: "${href}" on page ${url}`);
                }
            });
        } catch (error) {
            console.warn(`Could not crawl ${url}: ${error.message}`);
        }
    }

    return Array.from(foundUrls);
};


export const analyzePageBatch = async (urls: string[], apiKey: string): Promise<CrawledPage[]> => {
    if (!apiKey) throw new Error("Gemini API key is required for page analysis.");
    const ai = new GoogleGenAI({ apiKey });

    const pagesWithHtml = await Promise.all(
        urls.map(async url => {
            try {
                const html = await fetchWithProxy(url);
                return { url, html };
            } catch (error) {
                return { url, html: null, error: error.message };
            }
        })
    );
    
    const validPages = pagesWithHtml.filter(p => p.html !== null);
    const failedPages = pagesWithHtml.filter(p => p.html === null);

    const crawlPrompt = `You are an expert SEO content analyst. I will provide you with an array of objects, where each object contains a URL and its full HTML content. Your mission is to analyze the HTML for each URL and return a JSON array of analysis objects.

**Data Provided**: ${JSON.stringify(validPages)}

**Analysis Protocol for EACH page's HTML:**

1.  **Status Inference**:
    *   From the HTML content, determine the page status. If the title or body contains text like "404 Not Found", "Page not found", etc., infer **Status 404**.
    *   If the content looks like a normal webpage, infer **Status 200**.
    *   Look for \`<meta http-equiv="refresh" ...>\` for client-side redirects and infer **Status 301**.
    *   If you cannot determine status from the content, default to 200.

2.  **Content Extraction (ONLY if Status is 200-like)**:
    *   **title**: Extract the exact full \`<title>\` tag content. If missing, state "N/A".
    *   **description**: Extract the exact full \`<meta name="description" content="...">\` tag content. If missing, state "N/A".
    *   **h1**: Extract the text from the primary \`<h1>\` tag on the page. If missing, state "N/A".
    *   **contentPreview**: Provide a snippet of the main body text from the page, up to the first 200 characters, removing excess whitespace.
    *   **metaTags**: Extract ALL \`<meta>\` tags from the \`<head>\`, including those with \`name\` and \`property\` attributes (like for Open Graph).
    *   **Link Extraction & Context**: Analyze all unique HTTP/HTTPS \`href\` attributes on \`<a>\` tags.
        *   You MUST explicitly EXCLUDE non-web links like \`mailto:\`, \`tel:\`, \`javascript:\`, and fragment-only links (e.g., \`#top\`).
        *   **internalLinks**: Return the COUNT of unique hrefs pointing to the same hostname as the page's URL.
        *   **externalLinks**: Return the COUNT of unique hrefs pointing to a different hostname.
        *   **internalLinkUrls**: Return a JSON ARRAY of objects for all unique internal links. Each object must have two keys: \`url\` (the full link URL) and \`anchor\` (the anchor text inside the <a> tag). If the link is on an image, use the image's \`alt\` text as the anchor. If no anchor or alt text exists, use "N/A".
        *   **externalLinkUrls**: Return a JSON ARRAY of objects for all unique external links, following the same structure as \`internalLinkUrls\`.

3.  **Non-200 Status Handling**: For any URL inferred as not 200, report its status. All other fields MUST be "N/A", 0, or empty arrays.

**ABSOLUTE RULES:**
*   Your output MUST be based ONLY on the provided HTML content. Do NOT search for external information.
*   You MUST return a JSON array with an object for every single URL provided in the input, even if analysis fails.

**Output Format:**
Return ONLY a valid JSON array of objects, matching this structure: \`{"url": string, "status": number, "title": string, "description": string, "h1": string, "contentPreview": string, "internalLinks": number, "externalLinks": number, "metaTags": Array<{name?: string, property?: string, content: string}>, "internalLinkUrls": Array<{"url": string, "anchor": string}>, "externalLinkUrls": Array<{"url": string, "anchor": string}>}\`.`;

    let results: CrawledPage[] = failedPages.map(page => ({
        url: page.url, status: 500, title: 'Fetch Failed', description: page.error, h1: 'N/A', contentPreview: 'N/A', internalLinks: 0, externalLinks: 0, metaTags: []
    }));

    if (validPages.length === 0) {
        return results;
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: crawlPrompt
    });

    try {
        const responseText = response?.text;
        if (!responseText) {
            const blockReason = response?.candidates?.[0]?.finishReason;
            if (blockReason === 'SAFETY') {
                throw new Error("The AI's response was blocked due to safety concerns. This can happen with certain website content.");
            }
            throw new Error("AI returned an empty or invalid response.");
        }

        const jsonText = extractJson(responseText);
        if (jsonText === "") throw new Error("AI returned a response without valid JSON content.");
        
        const parsedData = JSON.parse(jsonText);
        if (!Array.isArray(parsedData)) throw new Error("Parsed data is not an array.");

        const aiResults: CrawledPage[] = parsedData.map(item => ({
            url: item?.url ?? 'Unknown URL', status: item?.status ?? 500, title: item?.title ?? 'N/A',
            description: item?.description ?? 'N/A', h1: item?.h1 ?? 'N/A', contentPreview: item?.contentPreview ?? 'N/A',
            internalLinks: item?.internalLinks ?? 0, externalLinks: item?.externalLinks ?? 0, metaTags: item?.metaTags ?? [],
            internalLinkUrls: item?.internalLinkUrls ?? [],
            externalLinkUrls: item?.externalLinkUrls ?? [],
        }));
        
        return [...results, ...aiResults];
    } catch (error) {
        console.error("Failed to parse Gemini response for page batch analysis:", error, "Raw response:", response?.text);
        const errorResults = validPages.map(page => ({
            url: page.url, status: 500, title: "Analysis Failed", description: error.message || "Could not parse AI response for this batch.",
            h1: "N/A", contentPreview: "N/A", internalLinks: 0, externalLinks: 0, metaTags: [],
        }));
        return [...results, ...errorResults];
    }
};

/**
 * Uses Gemini to parse the content of a single sitemap file.
 * @param sitemapContent The XML content of the sitemap.
 * @param apiKey The user's Gemini API key.
 * @returns A promise that resolves to an array of sitemap entries.
 */
async function parseSitemapWithAI(sitemapContent: string, apiKey: string): Promise<SitemapEntry[]> {
    const ai = new GoogleGenAI({ apiKey });

    const sitemapPrompt = `You are an expert XML parsing tool. Below is the raw text content of a sitemap.xml file. Your task is to parse it and extract every URL entry.

**Sitemap Content:**
\`\`\`xml
${sitemapContent}
\`\`\`

**Methodology:**
1.  **Parse the XML**: Analyze the provided text and identify all URL entries (typically within \`<url>\` or \`<sitemap>\` tags).
2.  **Handle Sitemap Indexes**: If this is a sitemap index file, list the URLs of the sub-sitemaps.
3.  **Data Extraction**: For each URL, extract its \`loc\`, \`lastmod\`, \`changefreq\`, and \`priority\`.
4.  **Defaults for Missing Data**: If a field is missing, use these defaults: \`lastmod: ""\`, \`changefreq: ""\`, \`priority: 0.5\`.
5.  **ABSOLUTE RULE**: Only list URLs found within the provided sitemap content.

**Final Output:**
*   Return ONLY a valid JSON array of objects.
*   If the content is not a valid sitemap or is empty, you MUST return an empty JSON array: \`[]\`.`;

    const response = await ai.models.generateContent({ 
        model: "gemini-2.5-flash", 
        contents: sitemapPrompt,
        config: { maxOutputTokens: 8192 } 
    });
    
    try {
        const responseText = response?.text;
        if (!responseText) {
            const blockReason = response?.candidates?.[0]?.finishReason;
             if (blockReason === 'SAFETY') {
                throw new Error("The AI's response was blocked due to safety concerns. This can happen with certain sitemap content.");
            }
            throw new Error("AI returned an empty response for the sitemap.");
        }
        
        const jsonText = extractJson(responseText);
        if (jsonText === "" || jsonText === "[]") return [];
        const parsedData = JSON.parse(jsonText);
        if (!Array.isArray(parsedData)) throw new Error("Parsed data is not an array.");
        
        return parsedData.map(item => ({
            loc: item?.loc ?? '', lastmod: item?.lastmod ?? '',
            changefreq: item?.changefreq ?? '', priority: item?.priority ?? 0.5,
        })).filter(item => item.loc);
    } catch (error) {
        console.error("Failed to parse Gemini response for sitemap:", error, "Raw response:", response?.text);
        throw new Error(`Failed to get valid sitemap data from the AI. Reason: ${error.message}`);
    }
}

/**
 * Recursively discovers all page URLs from a website's sitemaps, starting from robots.txt.
 * @param url The base URL of the website.
 * @param apiKey The user's Gemini API key.
 * @returns A promise resolving to an array of all found sitemap entries.
 */
export const fetchAllUrlsFromSitemaps = async (url: string, apiKey: string): Promise<SitemapEntry[]> => {
    if (!apiKey) throw new Error("Gemini API key is required for sitemap analysis.");

    const visitedSitemaps = new Set<string>();
    const allEntries: SitemapEntry[] = [];
    const queue: string[] = [];
    const origin = new URL(url).origin;

    // 1. Find initial sitemap URLs from robots.txt
    try {
        const robotsTxtContent = await fetchWithProxy(`${origin}/robots.txt`);
        const sitemapLines = robotsTxtContent.split('\n').filter(line => line.toLowerCase().startsWith('sitemap:'));
        if (sitemapLines.length > 0) {
            sitemapLines.forEach(line => {
                const sitemapUrl = line.substring(line.indexOf(':') + 1).trim();
                if (sitemapUrl) queue.push(sitemapUrl);
            });
        }
    } catch (e) {
        console.warn("Could not fetch or parse robots.txt, will try default sitemap location.", e.message);
    }
    
    // 2. If no sitemaps found in robots.txt, add the default one.
    if (queue.length === 0) {
        queue.push(`${origin}/sitemap.xml`);
    }

    // 3. Process the queue of sitemaps recursively
    while (queue.length > 0) {
        const currentSitemapUrl = queue.shift()!;
        if (visitedSitemaps.has(currentSitemapUrl)) {
            continue;
        }
        visitedSitemaps.add(currentSitemapUrl);

        try {
            const sitemapContent = await fetchWithProxy(currentSitemapUrl);
            const entries = await parseSitemapWithAI(sitemapContent, apiKey);

            for (const entry of entries) {
                if (entry.loc.toLowerCase().endsWith('.xml') || entry.loc.toLowerCase().endsWith('.xml.gz')) {
                    if (!visitedSitemaps.has(entry.loc)) {
                        queue.push(entry.loc);
                    }
                } else {
                    allEntries.push(entry);
                }
            }
        } catch (error) {
            console.warn(`Could not fetch or parse sitemap ${currentSitemapUrl}: ${error.message}`);
        }
    }

    return allEntries;
};

export const analyzeRobotsTxt = async (url: string, apiKey: string): Promise<RobotsTxtAnalysis> => {
    if (!apiKey) throw new Error("Gemini API key is required for robots.txt analysis.");
    const ai = new GoogleGenAI({ apiKey });

    let robotsTxtContent: string;
    try {
        robotsTxtContent = await fetchWithProxy(`${new URL(url).origin}/robots.txt`);
    } catch (error) {
        // If fetch fails, it's likely a 404, meaning no robots.txt exists.
        return { rules: [], sitemaps: [] };
    }

    const prompt = `You are a technical SEO expert. Your task is to parse the provided robots.txt file content and structure the data as JSON.

**robots.txt Content:**
\`\`\`
${robotsTxtContent}
\`\`\`

**Methodology:**
1.  **Analyze Content**: Parse all the directives from the provided text. Identify all User-agent sections, 'Allow'/'Disallow' rules, and any 'Sitemap' URLs.
2.  **Structure the Data**: Organize the extracted data into the specified JSON format.

**Format the Final Response:** Return ONLY a valid JSON object with two top-level keys: "rules" and "sitemaps".
*   \`rules\`: An array of objects, each with "userAgent", "type" ('Allow' or 'Disallow'), and "path".
*   \`sitemaps\`: An array of strings representing sitemap URLs.

**CRITICAL RULES:**
*   If the provided content is empty, you MUST return a JSON object with empty arrays: \`{"rules": [], "sitemaps": []}\`.`;

    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });

    try {
        const responseText = response?.text;
        if (!responseText) {
            const blockReason = response?.candidates?.[0]?.finishReason;
            if (blockReason === 'SAFETY') {
                throw new Error("The AI's response for robots.txt was blocked due to safety concerns.");
            }
            return { rules: [], sitemaps: [] };
        }
        
        const jsonText = extractJson(responseText);
        if (jsonText === "") return { rules: [], sitemaps: [] };
        
        const parsedData = JSON.parse(jsonText);
        if (typeof parsedData !== 'object' || parsedData === null || !('rules' in parsedData) || !('sitemaps' in parsedData)) {
            throw new Error("Parsed data does not match the expected RobotsTxtAnalysis structure.");
        }
        
        return parsedData as RobotsTxtAnalysis;
    } catch (error) {
        console.error("Failed to parse Gemini response for robots.txt:", error, "Raw response:", response?.text);
        throw new Error(`Failed to get valid robots.txt data from the AI. Reason: ${error.message}`);
    }
};