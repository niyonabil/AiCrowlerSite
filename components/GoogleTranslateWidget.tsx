import React, { useEffect } from 'react';

// FIX: The global 'google' type is now defined in services/googleService.ts to avoid conflicts.
// This file will now use that central definition.

export const GoogleTranslateWidget: React.FC = () => {
  useEffect(() => {
    // Check if the Google Translate script is already on the page to prevent duplicates
    const existingScript = document.querySelector('script[src*="translate.google.com"]');
    
    const initializeWidget = () => {
      if (window.google && window.google.translate && document.getElementById('google_translate_element')) {
          new window.google.translate.TranslateElement(
              { pageLanguage: 'en', layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE },
              'google_translate_element'
          );
      }
    };

    if (!existingScript) {
        // Define the initialization callback function on the window object.
        // Google's script will call this function once it has loaded.
        window.googleTranslateElementInit = initializeWidget;

        // Create a new script element for the Google Translate API.
        const script = document.createElement('script');
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        document.body.appendChild(script);

        // Clean up by removing the global function when the component unmounts.
        return () => {
            delete window.googleTranslateElementInit;
        };
    } else {
        // If the script is already there, the widget might re-initialize on its own.
        // We can also try to manually trigger it if the div exists.
        initializeWidget();
    }
  }, []);

  return (
    // This div is the target for the Google Translate widget.
    <div id="google_translate_element" className="not-prose"></div>
  );
};