import React, { useEffect } from 'react';

interface AdSenseBlockProps {
    script: string;
}

export const AdSenseBlock: React.FC<AdSenseBlockProps> = ({ script }) => {
    useEffect(() => {
        if (!script) return;

        const scriptId = 'adsense-script';
        if (document.getElementById(scriptId)) {
            return;
        }

        try {
            const scriptEl = document.createElement('script');
            scriptEl.id = scriptId;
            scriptEl.async = true;
            
            // Extract src from the provided script tag
            const srcMatch = script.match(/src="([^"]+)"/);
            if (srcMatch && srcMatch[1]) {
                 scriptEl.src = srcMatch[1];
            } else {
                console.warn("AdSense script tag seems malformed. Could not find src.")
                return;
            }

            // Extract client ID
            const clientMatch = script.match(/client=([^"&]+)/);
            if(clientMatch && clientMatch[1]) {
                scriptEl.setAttribute('data-ad-client', clientMatch[1]);
            }

            document.head.appendChild(scriptEl);

        } catch (e) {
            console.error('Failed to inject AdSense script:', e);
        }

    }, [script]);

    if (!script) return null;

    // This is a placeholder for a standard AdSense display ad unit.
    // In a real application, you would replace the style and data-ad-client/data-ad-slot
    // with actual values from your AdSense account.
    return (
        <div className="w-full my-4 p-4 bg-slate-800/50 rounded-lg text-center text-slate-500 border border-slate-700">
            <p className="text-xs mb-2">Advertisement</p>
             <ins className="adsbygoogle"
                 style={{ display: 'block' }}
                 data-ad-client="ca-pub-1234567890123456" // Replace with actual client ID
                 data-ad-slot="1234567890" // Replace with actual ad slot
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
        </div>
    );
};