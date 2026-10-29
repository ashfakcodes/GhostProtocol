/**
 * GhostProtocol WebCrypto Engine
 * Client-Side AES-256-GCM + PBKDF2 Key Splitting (Shamir/XOR Dual-Share)
 * 
 * Guarantee: Plaintext directives and cold keys NEVER leave the browser unencrypted.
 */

// Helper to convert Uint8Array to hex string
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to convert hex string to Uint8Array
export function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

export interface SplitKeyResult {
  shareA: string; // Deposited to NEAR Smart Contract
  shareB: string; // Given to Beneficiary
  ciphertext: string; // Base64 AES-GCM payload
  iv: string; // 12-byte IV hex
}

/**
 * Encrypts a private note client-side and splits the 256-bit AES key into Share A and Share B.
 */
export async function encryptAndSplit(plaintext: string): Promise<SplitKeyResult> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 1. Generate 32-byte master key
  const masterKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(masterKeyBytes);

  // 2. Generate 12-byte initialization vector (IV)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // 3. Import key for AES-GCM encryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // 4. Encrypt payload
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cryptoKey,
    data as BufferSource
  );

  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

  // 5. Split master key into Share A and Share B using XOR
  const shareBBytes = new Uint8Array(32);
  crypto.getRandomValues(shareBBytes);

  const shareABytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    shareABytes[i] = masterKeyBytes[i] ^ shareBBytes[i];
  }

  return {
    shareA: toHex(shareABytes),
    shareB: toHex(shareBBytes),
    ciphertext,
    iv: toHex(iv)
  };
}

/**
 * Recombines Share A + Share B and decrypts the AES-GCM ciphertext in browser memory.
 */
export async function recombineAndDecrypt(
  shareAHex: string,
  shareBHex: string,
  ciphertextBase64: string,
  ivHex: string
): Promise<string> {
  const shareA = fromHex(shareAHex.trim());
  const shareB = fromHex(shareBHex.trim());

  if (shareA.length !== 32 || shareB.length !== 32) {
    throw new Error('Invalid key share length. Each share must be 32 bytes (64 hex characters).');
  }

  // XOR Recombination: K = Share A ^ Share B
  const masterKeyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    masterKeyBytes[i] = shareA[i] ^ shareB[i];
  }

  const iv = fromHex(ivHex.trim());
  const encryptedBytes = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cryptoKey,
    encryptedBytes as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
