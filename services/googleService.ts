// This service handles the Google Search Console API integration.
// IMPORTANT: To use this feature, you must:
// 1. Create an "OAuth 2.0 Client ID" in your Google Cloud project console.
// 2. Add your application's URL (e.g., http://localhost:XXXX or your production URL)
//    to the "Authorized JavaScript origins" section for that Client ID.
// 3. The user must paste their Client ID into the Settings page.

// FIX: Consolidate the global 'google' type definition to include both 'accounts' and 'translate'
// properties, resolving type conflicts across the application.
declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      accounts?: {
        oauth2: {
          initTokenClient: (config: any) => any;
        };
        // FIX: Add the 'id' property for Google Identity Services (Sign-In Button).
        // This resolves errors where 'id' was not found on 'window.google.accounts'.
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
        };
      };
      translate?: {
        TranslateElement: {
          new (
            options: { pageLanguage: string; layout: any },
            elementId: string
          ): void;
          InlineLayout: {
            SIMPLE: any;
          };
        };
      };
    };
  }
}

const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/indexing';

let tokenClient: any;

export const initAndGetSites = (
    clientId: string,
    onSuccess: (sites: string[]) => void, 
    onError: (error: Error) => void
) => {
    if (!clientId) {
        onError(new Error("Google Client ID is not configured. Please add it in the Settings page."));
        return;
    }
    
    if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
        onError(new Error("Google Identity Services library has not loaded. This might be due to a network issue or an ad blocker."));
        return;
    }
    
    try {
         tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: async (tokenResponse: any) => {
                if (tokenResponse.error) {
                    let message = `Google authentication error: ${tokenResponse.error_description || tokenResponse.error}`;
                    // FIX: Provide a more helpful error message for common OAuth configuration issues.
                    if (['popup_closed_by_user', 'access_denied', 'immediate_failed', 'invalid_client'].includes(tokenResponse.error)) {
                         message += `\n\nThis commonly happens if the app's URL ('${window.location.origin}') is not in the "Authorized JavaScript origins" list in your Google Cloud project's OAuth settings. Please check your configuration.`;
                    }
                    onError(new Error(message));
                    return;
                }

                try {
                    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
                        headers: {
                            'Authorization': `Bearer ${tokenResponse.access_token}`
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error.message || `Failed to fetch sites with status: ${response.status}`);
                    }

                    const data = await response.json();
                    const sites = data.siteEntry
                        ?.map((entry: { siteUrl: string }) => entry.siteUrl)
                        .filter(Boolean) || [];

                    onSuccess(sites);

                } catch (e) {
                    onError(e instanceof Error ? e : new Error("An unknown error occurred while fetching sites."));
                }
            },
        });

        tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
        onError(e instanceof Error ? e : new Error("Failed to initialize Google authentication. Check your Client ID."));
    }
};

export const submitUrlsToGoogle = (
    urls: string[], 
    clientId: string,
    onProgress: (submitted: number, total: number) => void
): Promise<{ success: number, failed: number }> => {
    return new Promise((resolve, reject) => {
        if (!clientId) {
            return reject(new Error("Google Client ID is not configured."));
        }
        if (typeof window.google === 'undefined' || typeof window.google.accounts === 'undefined') {
            return reject(new Error("Google Identity Services library not loaded."));
        }

        const indexingTokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/indexing',
            callback: async (tokenResponse: any) => {
                if (tokenResponse.error) {
                    let message = `Google authentication error: ${tokenResponse.error_description || tokenResponse.error}`;
                    // FIX: Provide a more helpful error message for common OAuth configuration issues.
                    if (['popup_closed_by_user', 'access_denied', 'immediate_failed', 'invalid_client'].includes(tokenResponse.error)) {
                         message += `\n\nThis commonly happens if the app's URL ('${window.location.origin}') is not in the "Authorized JavaScript origins" list in your Google Cloud project's OAuth settings. Please check your configuration.`;
                    }
                    return reject(new Error(message));
                }

                let successCount = 0;
                let failedCount = 0;

                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i];
                    try {
                        const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${tokenResponse.access_token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                url: url,
                                type: 'URL_UPDATED'
                            })
                        });

                        if (!response.ok) {
                             const errorData = await response.json();
                             const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
                             console.warn(`Failed to submit ${url}: ${errorMessage}`);
                             failedCount++;
                        } else {
                            successCount++;
                        }
                    } catch (e) {
                        console.error(`Error submitting ${url}:`, e);
                        failedCount++;
                    }
                    onProgress(i + 1, urls.length);
                }
                
                resolve({ success: successCount, failed: failedCount });
            },
        });

        indexingTokenClient.requestAccessToken({ prompt: 'consent' });
    });
};