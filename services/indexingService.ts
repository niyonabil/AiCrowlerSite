export const submitToIndexNow = async (urls: string[], apiKey: string, siteUrl: string): Promise<Response> => {
    if (!apiKey) {
        throw new Error("IndexNow API key is not provided.");
    }
    if (!urls || urls.length === 0) {
        throw new Error("No URLs to submit.");
    }

    const host = new URL(siteUrl).hostname;
    // The key location can be derived from the site's origin, which is a common practice for IndexNow.
    const keyLocation = `${new URL(siteUrl).origin}/${apiKey}.txt`;

    const payload = {
        host: host,
        key: apiKey,
        keyLocation: keyLocation,
        urlList: urls,
    };

    const response = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetails = `Request failed with status ${response.status}.`;
        try {
            // Try to get more info from the response body if available
            const errorData = await response.json();
            errorDetails += ` Message: ${errorData.message || JSON.stringify(errorData)}`;
        } catch (e) {
            // Ignore if response is not JSON
        }
        throw new Error(errorDetails);
    }

    // Return the raw response on success (e.g., for status code checks)
    return response;
};