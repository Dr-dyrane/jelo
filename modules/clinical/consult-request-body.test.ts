import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '@/app/api/consult/route';
import {
  maxConsultJsonBytes,
  readBoundedConsultJson,
} from '@/lib/consult/request-body';

type StreamingRequestInit = RequestInit & { duplex: 'half' };

function streamingRequest(
  stream: ReadableStream<Uint8Array>,
  headers: HeadersInit = { 'Content-Type': 'application/json' },
) {
  return new Request('http://localhost/api/consult', {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  } as StreamingRequestInit);
}

test('consult JSON reader accepts a bounded chunked body without content-length', async () => {
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('{"query":"I need '),
    encoder.encode('ordinary sunscreen'),
    encoder.encode('","market":"NG"}'),
  ];
  let index = 0;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
  }, { highWaterMark: 0 });
  const request = streamingRequest(body);

  assert.equal(request.headers.has('content-length'), false);
  assert.deepEqual(await readBoundedConsultJson(request), {
    query: 'I need ordinary sunscreen',
    market: 'NG',
  });
});

test('consult JSON reader cancels a chunked body as soon as bytes exceed 64 KiB', async () => {
  const chunks = [
    new Uint8Array(maxConsultJsonBytes / 2),
    new Uint8Array(maxConsultJsonBytes / 2),
    new Uint8Array([1]),
    new Uint8Array([2]),
  ];
  let pulls = 0;
  let cancelReason: unknown;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[pulls++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel(reason) {
      cancelReason = reason;
    },
  }, { highWaterMark: 0 });
  const request = streamingRequest(body);

  assert.equal(request.headers.has('content-length'), false);
  await assert.rejects(
    readBoundedConsultJson(request),
    { message: 'payload_too_large' },
  );
  assert.equal(cancelReason, 'payload_too_large');
  assert.equal(pulls, 3, 'the reader must not pull another chunk after overflow');
});

test('consult JSON reader cancels a declared oversized body before reading it', async () => {
  let pulls = 0;
  let cancelReason: unknown;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array([123]));
    },
    cancel(reason) {
      cancelReason = reason;
    },
  }, { highWaterMark: 0 });
  const request = streamingRequest(body, {
    'Content-Type': 'application/json',
    'Content-Length': String(maxConsultJsonBytes + 1),
  });

  await assert.rejects(
    readBoundedConsultJson(request),
    { message: 'payload_too_large' },
  );
  assert.equal(cancelReason, 'payload_too_large');
  assert.equal(pulls, 0);
});

test('consult route returns 413 and cancels an oversized chunked request without content-length', async () => {
  const chunks = [
    new Uint8Array(maxConsultJsonBytes),
    new Uint8Array([1]),
    new Uint8Array([2]),
  ];
  let pulls = 0;
  let cancelReason: unknown;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[pulls++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel(reason) {
      cancelReason = reason;
    },
  }, { highWaterMark: 0 });

  const response = await POST(streamingRequest(body));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'That description is too long.' });
  assert.equal(cancelReason, 'payload_too_large');
  assert.equal(pulls, 2, 'the route must stop consuming immediately after overflow');
});
