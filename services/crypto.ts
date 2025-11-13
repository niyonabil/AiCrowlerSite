const SECRET_KEY = 'ai-auditor-pro-secret-key'; // A simple, fixed key for XOR encryption

/**
 * Encrypts a string using a simple XOR cipher.
 * Not for high-security use, but obscures data in client-side storage.
 * @param text The plaintext string to encrypt.
 * @returns A base64 encoded encrypted string.
 */
export const encrypt = (text: string): string => {
  if (!text) return '';
  const textChars = text.split('');
  const keyChars = SECRET_KEY.split('');
  
  const encryptedChars = textChars.map((char, i) => {
    const charCode = char.charCodeAt(0);
    const keyCode = keyChars[i % keyChars.length].charCodeAt(0);
    return String.fromCharCode(charCode ^ keyCode);
  });

  return btoa(encryptedChars.join(''));
};

/**
 * Decrypts a string that was encrypted with the XOR cipher.
 * @param encryptedText The base64 encoded encrypted string.
 * @returns The original plaintext string.
 */
export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return '';
  try {
    const decodedText = atob(encryptedText);
    const decodedChars = decodedText.split('');
    const keyChars = SECRET_KEY.split('');

    const decryptedChars = decodedChars.map((char, i) => {
        const charCode = char.charCodeAt(0);
        const keyCode = keyChars[i % keyChars.length].charCodeAt(0);
        return String.fromCharCode(charCode ^ keyCode);
    });

    return decryptedChars.join('');
  } catch (error) {
      // If decryption fails (e.g., it was plaintext before), return the original string
      console.warn("Decryption failed for a key, returning original text.");
      return encryptedText;
  }
};
