import { isOriginMediaKey, normalizeR2Event, type NormalizedMediaEvent } from "./event";

type Env = {
  MEDIA_EVENT_HMAC_SECRET: string;
  MEDIA_EVENTS_ENDPOINT: string;
};

type QueueMessage<T> = {
  id: string;
  timestamp: Date;
  body: T;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

type QueueBatch<T> = {
  messages: Array<QueueMessage<T>>;
};

function base64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
}

export async function handleQueueBatch(
  batch: QueueBatch<unknown>,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  for (const message of batch.messages) {
    const event = normalizeR2Event(message.body, message.id);
    if (!event || !isOriginMediaKey(event.object.key)) {
      // The same media prefix also contains derivatives. They must not create
      // another media job when the preparer uploads audio/poster output.
      message.ack();
      continue;
    }

    const normalized: NormalizedMediaEvent = { version: 1, messageId: message.id, ...event };
    const body = JSON.stringify(normalized);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await sign(env.MEDIA_EVENT_HMAC_SECRET, timestamp, body);
    let response: Response;
    try {
      response = await fetchImpl(env.MEDIA_EVENTS_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-media-event-timestamp": timestamp,
          "x-media-event-signature": signature,
        },
        body,
      });
    } catch {
      message.retry({ delaySeconds: Math.min(300, 15 * (message.attempts + 1)) });
      continue;
    }

    if (response.ok) {
      message.ack();
    } else {
      // Keep every non-2xx response retryable. This includes permanent
      // validation failures: after the retry budget they become visible in
      // the configured DLQ instead of silently disappearing.
      message.retry({ delaySeconds: Math.min(300, 15 * (message.attempts + 1)) });
    }
  }
}

export default {
  async queue(batch: QueueBatch<unknown>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env);
  },
};
