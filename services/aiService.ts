import { GoogleGenAI, Type } from "@google/genai";
import { CrawledPage, SitemapEntry, RobotsTxtAnalysis, AIAgent, AdsTxtAnalysis } from '../types';

// Use a CORS proxy to fetch content directly from websites, bypassing browser security limitations.
const PROXY_URL = 'https://corsproxy.io/?';

/**
 * Fetches the content of a URL using a CORS proxy, with built-in retries and timeout.
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
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
    }
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
                    
                    if (urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
                        return;
                    }

                    const absoluteUrl = urlObject.href.split('#')[0];

                    if (urlObject.hostname === baseUrl.hostname && !visited.has(absoluteUrl)) {
                        visited.add(absoluteUrl);
                        foundUrls.add(absoluteUrl);
                        queue.push({ url: absoluteUrl, depth: depth + 1 });
                    }
                } catch (e) {
                    console.warn(`Could not parse link href: "${href}" on page ${url}`);
                }
            });
        } catch (error) {
            console.warn(`Could not crawl ${url}: ${error.message}`);
        }
    }

    return Array.from(foundUrls);
};

export const analyzePageBatch = async (urls: string[], agent: AIAgent, apiKey: string): Promise<CrawledPage[]> => {
    if (!apiKey) throw new Error(`${agent.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key is required.`);
    
    const pagesWithHtml = await Promise.all(
        urls.map(async url => {
            try {
                const html = await fetchWithProxy(url);
                return { url, html, status: 200, error: null };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const match = message.match(/status (\d+)/);
                const status = match ? parseInt(match[1], 10) : 500; // Default to 500 for other network errors
                return { url, html: null, error: message, status: status };
            }
        })
    );
    
    const validPages = pagesWithHtml.filter(p => p.html !== null);
    const failedPages = pagesWithHtml.filter(p => p.html === null);

    let results: CrawledPage[] = failedPages.map(page => ({
        url: page.url,
        status: page.status,
        title: 'Fetch Failed',
        description: page.error || 'N/A',
        h1: 'N/A',
        contentPreview: 'N/A',
        internalLinks: 0,
        externalLinks: 0,
        metaTags: []
    }));

    if (validPages.length === 0) {
        return results;
    }

    const validPagesForPrompt = validPages.map(({ url, html }) => ({ url, html }));

    const commonPrompt = `
**Analysis Protocol for EACH page's HTML:**

1.  **Status Inference**: From the HTML, infer status (200, 404, 301). Default to 200 if unsure.
2.  **Content Extraction (for status 200)**: Extract \`title\`, \`meta description\`, primary \`h1\`, a 200-char \`contentPreview\`, and all \`metaTags\`.
3.  **Link Extraction**: Count unique internal/external links (\`<a>\` tags with http/https). Provide details for \`internalLinkUrls\` and \`externalLinkUrls\` as arrays of objects containing \`url\` and \`anchor\` text.
4.  **Non-200 Handling**: For non-200 pages, all fields besides status should be "N/A", 0, or empty arrays.

**ABSOLUTE RULES:**
*   Analyze ONLY the provided HTML.
*   Return a JSON array with an object for every URL, even if analysis fails.

**Output Format:**
Return ONLY a valid JSON array of objects, matching this structure: \`{"url": string, "status": number, "title": string, "description": string, "h1": string, "contentPreview": string, "internalLinks": number, "externalLinks": number, "metaTags": Array<{name?: string, property?: string, content: string}>, "internalLinkUrls": Array<{"url": string, "anchor": string}>, "externalLinkUrls": Array<{"url": string, "anchor": string}>}\`.`;
    
    let parsedData;

    try {
        if (agent.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            const crawlPrompt = `${agent.system_prompt}\n\nI will provide you with an array of objects, each containing a URL and its HTML. Your mission is to analyze each one.\n\n**Data Provided**: ${JSON.stringify(validPagesForPrompt)}\n\n${commonPrompt}`;
            const response = await ai.models.generateContent({ model: agent.model, contents: crawlPrompt });
            const responseText = response.text;
            
            // Early exit for API errors that return a JSON error object
            if (responseText && responseText.trim().startsWith('{"error"')) {
                try {
                    const errorObj = JSON.parse(responseText);
                    if (errorObj.error?.message) {
                        throw new Error(`Gemini API Error: ${errorObj.error.message}`);
                    }
                } catch(e) { /* fall through to generic error */ }
            }

            const jsonText = extractJson(responseText);
            if (jsonText === "") throw new Error("AI returned a response without valid JSON content.");
            parsedData = JSON.parse(jsonText);

        } else if (agent.provider === 'openai' || agent.provider === 'openrouter') {
            const isOpenRouter = agent.provider === 'openrouter';
            const apiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
            
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        
            if (isOpenRouter) {
                headers['HTTP-Referer'] = location.origin;
                headers['X-Title'] = 'AI Auditor Pro';
            }

            const userPrompt = `Here is the data for you to analyze:\n\n${JSON.stringify(validPagesForPrompt)}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: agent.model,
                    messages: [
                        { role: 'system', content: `${agent.system_prompt}. You must respond with a single JSON array, adhering to the user's specified format. The array should contain an analysis object for each URL provided.` },
                        { role: 'user', content: `${userPrompt}\n\n${commonPrompt}` }
                    ],
                    response_format: { type: "json_object" } 
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API Error: ${errorData.error.message}`);
            }
            const result = await response.json();
            const content = result.choices[0].message.content;
            const extractedContent = extractJson(content);
            parsedData = JSON.parse(extractedContent);
            if(parsedData && !Array.isArray(parsedData) && Object.keys(parsedData).length === 1 && Array.isArray(Object.values(parsedData)[0])) {
                parsedData = Object.values(parsedData)[0];
            }
        }

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
        console.error(`Failed to parse ${agent.provider} response for page batch analysis:`, error);
        
        const isRateLimitError = error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit');
        const errorMessage = isRateLimitError
            ? "API rate limit exceeded. Please wait a moment and try again."
            : error.message || "Could not parse AI response.";

        const errorResults = validPages.map(page => ({
            url: page.url, status: 500, title: "Analysis Failed", description: errorMessage,
            h1: "N/A", contentPreview: "N/A", internalLinks: 0, externalLinks: 0, metaTags: [],
        }));
        return [...results, ...errorResults];
    }
};


async function parseSitemapWithAI(sitemapContent: string, agent: AIAgent, apiKey: string): Promise<SitemapEntry[]> {
    const sitemapPrompt = `${agent.system_prompt}
**Task**: Parse the provided sitemap.xml content and extract every URL entry.
**Sitemap Content:** \`\`\`xml
${sitemapContent}
\`\`\`
**Methodology**:
1.  Parse the XML to find all URL entries (in \`<url>\` or \`<sitemap>\` tags).
2.  If it is a sitemap index, list the sub-sitemap URLs.
3.  For each URL, extract \`loc\`, \`lastmod\`, \`changefreq\`, and \`priority\`.
4.  Use defaults for missing data: \`lastmod: ""\`, \`changefreq: ""\`, \`priority: 0.5\`.
**Final Output**: Return ONLY a valid JSON array of objects. If the content is invalid or empty, return an empty array \`[]\`.`;

    let parsedData;
    
    try {
        if (agent.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ 
                model: agent.model, 
                contents: sitemapPrompt,
                config: { maxOutputTokens: 8192 } 
            });
            const jsonText = extractJson(response.text);
            if (jsonText === "" || jsonText === "[]") return [];
            parsedData = JSON.parse(jsonText);
        } else if (agent.provider === 'openai' || agent.provider === 'openrouter') {
            const isOpenRouter = agent.provider === 'openrouter';
            const apiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
            
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (isOpenRouter) {
                headers['HTTP-Referer'] = location.origin;
                headers['X-Title'] = 'AI Auditor Pro';
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: agent.model,
                    messages: [{ role: 'system', content: "You are an expert XML parsing tool designed to output JSON." },{ role: 'user', content: sitemapPrompt }],
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} request failed`);
            const result = await response.json();
            const content = result.choices[0].message.content;
            const extractedContent = extractJson(content);
            parsedData = JSON.parse(extractedContent);
             if(parsedData && !Array.isArray(parsedData) && Object.keys(parsedData).length === 1 && Array.isArray(Object.values(parsedData)[0])) {
                parsedData = Object.values(parsedData)[0];
            }
        }

        if (!Array.isArray(parsedData)) throw new Error("Parsed data is not an array.");
        
        return parsedData.map(item => ({
            loc: item?.loc ?? '', lastmod: item?.lastmod ?? '',
            changefreq: item?.changefreq ?? '', priority: item?.priority ?? 0.5,
        })).filter(item => item.loc);
    } catch (error) {
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
            throw new Error('API rate limit exceeded while parsing sitemap. Please wait a moment and try again.');
        }
        console.error(`Failed to parse ${agent.provider} response for sitemap:`, error);
        throw new Error(`Failed to get valid sitemap data from the AI. Reason: ${error.message}`);
    }
}

export const fetchAllUrlsFromSitemaps = async (url: string, agent: AIAgent, apiKey: string): Promise<SitemapEntry[]> => {
    if (!apiKey) throw new Error(`${agent.provider} API key is required.`);

    const visitedSitemaps = new Set<string>();
    const allEntries: SitemapEntry[] = [];
    const queue: string[] = [];
    const origin = new URL(url).origin;

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
    
    if (queue.length === 0) {
        queue.push(`${origin}/sitemap.xml`);
    }

    while (queue.length > 0) {
        const currentSitemapUrl = queue.shift()!;
        if (visitedSitemaps.has(currentSitemapUrl)) {
            continue;
        }
        visitedSitemaps.add(currentSitemapUrl);

        try {
            const sitemapContent = await fetchWithProxy(currentSitemapUrl);
            const entries = await parseSitemapWithAI(sitemapContent, agent, apiKey);

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

        // Add a delay to avoid hitting API rate limits if there are more sitemaps to process
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay
        }
    }

    return allEntries;
};

export const analyzeRobotsTxt = async (url: string, agent: AIAgent, apiKey: string): Promise<RobotsTxtAnalysis> => {
    if (!apiKey) throw new Error(`${agent.provider} API key is required.`);

    let robotsTxtContent: string;
    try {
        robotsTxtContent = await fetchWithProxy(`${new URL(url).origin}/robots.txt`);
    } catch (error) {
        return { rules: [], sitemaps: [] };
    }

    const prompt = `${agent.system_prompt}
**Task**: Parse the provided robots.txt content and structure it as JSON.
**robots.txt Content:** \`\`\`
${robotsTxtContent}
\`\`\`
**Methodology**:
1.  Parse all directives: User-agent sections, 'Allow'/'Disallow' rules, and 'Sitemap' URLs.
2.  Structure the data into the specified JSON format.
**Format**: Return ONLY a valid JSON object with two keys: "rules" (an array of objects with "userAgent", "type", "path") and "sitemaps" (an array of strings).
**CRITICAL**: If content is empty, return \`{"rules": [], "sitemaps": []}\`.`;

    let parsedData;

    try {
        if (agent.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ model: agent.model, contents: prompt });
            const jsonText = extractJson(response.text);
            if (jsonText === "") return { rules: [], sitemaps: [] };
            parsedData = JSON.parse(jsonText);
        } else if (agent.provider === 'openai' || agent.provider === 'openrouter') {
            const isOpenRouter = agent.provider === 'openrouter';
            const apiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            if (isOpenRouter) {
                headers['HTTP-Referer'] = location.origin;
                headers['X-Title'] = 'AI Auditor Pro';
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: agent.model,
                    messages: [{ role: 'system', content: "You are a technical SEO expert designed to output JSON." }, { role: 'user', content: prompt }],
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} request failed`);
            const result = await response.json();
            const content = result.choices[0].message.content;
            parsedData = JSON.parse(content);
        }
        
        if (typeof parsedData !== 'object' || parsedData === null || !('rules' in parsedData) || !('sitemaps' in parsedData)) {
            throw new Error("Parsed data does not match the expected RobotsTxtAnalysis structure.");
        }
        
        return parsedData as RobotsTxtAnalysis;
    } catch (error) {
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
            throw new Error('API rate limit exceeded. Please wait a moment and try again. If the problem persists, check your API plan and billing details.');
        }
        console.error(`Failed to parse ${agent.provider} response for robots.txt:`, error);
        throw new Error(`Failed to get valid robots.txt data from the AI. Reason: ${error.message}`);
    }
};

export const analyzeAdsTxt = async (url: string, agent: AIAgent, apiKey: string): Promise<AdsTxtAnalysis> => {
    if (!apiKey) throw new Error(`${agent.provider} API key is required.`);

    let adsTxtContent: string;
    try {
        adsTxtContent = await fetchWithProxy(`${new URL(url).origin}/ads.txt`);
    } catch (error) {
        return { records: [], malformedLines: [] };
    }

    const prompt = `${agent.system_prompt}
**Task**: You are an expert in digital advertising standards. Parse the provided ads.txt file content and structure the data as JSON.

**ads.txt Content:**
\`\`\`
${adsTxtContent}
\`\`\`

**Methodology:**
1.  **Analyze Each Line**: Read the file line by line. Ignore empty lines and lines starting with '#'.
2.  **Extract Data**: For each valid data line, parse it into four fields:
    *   \`domain\`: The domain name of the advertising system.
    *   \`publisherId\`: The publisher's account ID.
    *   \`relationship\`: The type of relationship ('DIRECT' or 'RESELLER').
    *   \`tagId\`: (Optional) The certification authority ID.
3.  **Handle Malformed Lines**: Any line that is not a comment and does not conform to the expected format should be collected.
4.  **Structure the Data**: Organize the extracted data into the specified JSON format.

**Format the Final Response**: Return ONLY a valid JSON object with two top-level keys: "records" and "malformedLines".
*   \`records\`: An array of objects, each with "domain", "publisherId", "relationship", and an optional "tagId".
*   \`malformedLines\`: An array of strings, containing any lines that could not be parsed.

**CRITICAL RULES:**
*   If the content is empty or contains no valid records, return \`{"records": [], "malformedLines": []}\`.`;
    
    let parsedData;
    try {
        if (agent.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ model: agent.model, contents: prompt });
            const jsonText = extractJson(response.text);
            if (jsonText === "") return { records: [], malformedLines: [] };
            parsedData = JSON.parse(jsonText);
        } else if (agent.provider === 'openai' || agent.provider === 'openrouter') {
            const isOpenRouter = agent.provider === 'openrouter';
            const apiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            if (isOpenRouter) {
                headers['HTTP-Referer'] = location.origin;
                headers['X-Title'] = 'AI Auditor Pro';
            }
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: agent.model,
                    messages: [{ role: 'system', content: "You are an expert in advertising standards designed to output JSON." }, { role: 'user', content: prompt }],
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} request failed`);
            const result = await response.json();
            const content = result.choices[0].message.content;
            parsedData = JSON.parse(content);
        }
        
        if (typeof parsedData !== 'object' || parsedData === null || !('records' in parsedData) || !('malformedLines' in parsedData)) {
            throw new Error("Parsed data does not match the expected AdsTxtAnalysis structure.");
        }
        
        return parsedData as AdsTxtAnalysis;
    } catch (error) {
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
            throw new Error('API rate limit exceeded. Please wait a moment and try again.');
        }
        console.error(`Failed to parse ${agent.provider} response for ads.txt:`, error);
        throw new Error(`Failed to get valid ads.txt data from the AI. Reason: ${error.message}`);
    }
};

export const generateBlogPost = async (topic: string, agent: AIAgent, apiKey: string): Promise<{ title: string; content: string; }> => {
    if (!apiKey) throw new Error(`${agent.provider} API key is required.`);

    const prompt = `${agent.system_prompt}
**Task**: You are a creative and engaging blog post writer. Generate a complete blog post based on the provided topic.

**Topic:**
"${topic}"

**Methodology:**
1.  **Title Generation**: Create a compelling, SEO-friendly title for the blog post.
2.  **Content Generation**: Write the main body of the article. The content should be well-structured, informative, and engaging. Use HTML tags for formatting, including:
    *   \`<h2>\` for main section headings.
    *   \`<p>\` for paragraphs.
    *   \`<ul>\` and \`<li>\` for unordered lists.
    *   \`<ol>\` and \`<li>\` for ordered lists.
    *   \`<b>\` or \`<strong>\` for bold text to emphasize key points.
    *   \`<i>\` or \`<em>\` for italicized text.
3.  **Structure**: Ensure the post flows logically and is easy for readers to follow.

**Format the Final Response**: Return ONLY a valid JSON object with two top-level keys: "title" and "content".
*   \`title\`: A string containing the generated blog post title.
*   \`content\`: A string containing the full blog post content, formatted with HTML.

**CRITICAL RULES:**
*   Do not include \`<html>\` or \`<body>\` tags in the content.
*   The output must be a single, valid JSON object and nothing else.`;

    let parsedData;
    try {
        if (agent.provider === 'gemini') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({ 
                model: agent.model, 
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            content: { type: Type.STRING }
                        },
                        required: ['title', 'content']
                    }
                }
            });
            const jsonText = extractJson(response.text);
            if (jsonText === "") throw new Error("AI returned empty content.");
            parsedData = JSON.parse(jsonText);
        } else if (agent.provider === 'openai' || agent.provider === 'openrouter') {
            const isOpenRouter = agent.provider === 'openrouter';
            const apiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
            const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            if (isOpenRouter) {
                headers['HTTP-Referer'] = location.origin;
                headers['X-Title'] = 'AI Auditor Pro';
            }
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: agent.model,
                    messages: [{ role: 'system', content: "You are a helpful blog writer designed to output JSON." }, { role: 'user', content: prompt }],
                    response_format: { type: "json_object" }
                })
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API Error: ${errorData.error.message}`);
            }
            const result = await response.json();
            const content = result.choices[0].message.content;
            parsedData = JSON.parse(content);
        }

        if (typeof parsedData !== 'object' || parsedData === null || !('title' in parsedData) || !('content' in parsedData)) {
            throw new Error("Parsed data does not match the expected structure ({title: string, content: string}).");
        }
        
        return parsedData as { title: string; content: string; };

    } catch (error) {
         if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
            throw new Error('API rate limit exceeded. Please wait a moment and try again.');
        }
        console.error(`Failed to parse ${agent.provider} response for blog post generation:`, error);
        throw new Error(`Failed to generate blog post from the AI. Reason: ${error.message}`);
    }
};