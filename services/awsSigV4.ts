/**
 * AWS Signature V4 — Browser-compatible implementation
 *
 * Uses the Web Crypto API (SubtleCrypto) for HMAC-SHA256 and SHA-256.
 * No external dependencies.
 */

const encoder = new TextEncoder();

async function sha256(data: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoder.encode(data));
}

async function hmacSHA256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getAmzDate(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

export interface SigV4Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Sign an HTTP request using AWS Signature V4.
 * Returns the request headers with Authorization and other required headers added.
 */
export async function signRequest(req: SigV4Request): Promise<Record<string, string>> {
  const { amzDate, dateStamp } = getAmzDate();
  const parsedUrl = new URL(req.url);
  const canonicalUri = parsedUrl.pathname;
  const canonicalQuerystring = parsedUrl.searchParams.toString();

  // Add required headers
  const headersToSign: Record<string, string> = {
    ...req.headers,
    'host': parsedUrl.host,
    'x-amz-date': amzDate,
  };

  // Build canonical headers (sorted, lowercased)
  const sortedHeaderKeys = Object.keys(headersToSign)
    .map(k => k.toLowerCase())
    .sort();

  const canonicalHeaders = sortedHeaderKeys
    .map(k => `${k}:${headersToSign[Object.keys(headersToSign).find(h => h.toLowerCase() === k)!].trim()}`)
    .join('\n') + '\n';

  const signedHeaders = sortedHeaderKeys.join(';');

  // Hash payload
  const payloadHash = toHex(await sha256(req.body));

  // Canonical request
  const canonicalRequest = [
    req.method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // Credential scope
  const credentialScope = `${dateStamp}/${req.region}/${req.service}/aws4_request`;

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join('\n');

  // Derive signing key
  const kDate = await hmacSHA256(encoder.encode(`AWS4${req.secretAccessKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacSHA256(kDate, req.region);
  const kService = await hmacSHA256(kRegion, req.service);
  const kSigning = await hmacSHA256(kService, 'aws4_request');

  // Calculate signature
  const signature = toHex(await hmacSHA256(kSigning, stringToSign));

  // Build Authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${req.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...req.headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'Authorization': authorization,
  };
}
