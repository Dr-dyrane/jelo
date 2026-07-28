export const maxConsultJsonBytes = 64 * 1024;

const payloadTooLarge = () => new Error('payload_too_large');

async function cancelBody(body: ReadableStream<Uint8Array> | null) {
  if (!body || body.locked) return;

  try {
    await body.cancel('payload_too_large');
  } catch {
    // The size decision is authoritative even if the source rejects cancellation.
  }
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel('payload_too_large');
  } catch {
    // The size decision is authoritative even if the source rejects cancellation.
  }
}

export async function readBoundedConsultJson(request: Request) {
  const contentLength = request.headers.get('content-length');
  const declaredBytes = contentLength === null ? undefined : Number(contentLength);

  if (
    declaredBytes !== undefined
    && Number.isFinite(declaredBytes)
    && declaredBytes > maxConsultJsonBytes
  ) {
    await cancelBody(request.body);
    throw payloadTooLarge();
  }

  if (!request.body) throw new Error('invalid_json');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxConsultJsonBytes) {
        await cancelReader(reader);
        throw payloadTooLarge();
      }

      // Retain only the bounded bytes, not a potentially larger backing buffer.
      chunks.push(value.slice());
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('invalid_json');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}
