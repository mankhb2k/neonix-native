export type R2ObjectCreateEvent = {
  account: string;
  action: string;
  bucket: string;
  eventTime: string;
  object: {
    key: string;
    size: number;
    eTag?: string;
  };
};

export type NormalizedMediaEvent = R2ObjectCreateEvent & {
  version: 1;
  messageId: string;
};

export function isOriginMediaKey(key: string): boolean {
  return /^media\/[^/]+\/[^/]+\/origin\.[a-zA-Z0-9]+$/.test(key);
}

export function normalizeR2Event(value: unknown, messageId: string): R2ObjectCreateEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const object = record.object;
  if (!object || typeof object !== "object") return null;
  const objectRecord = object as Record<string, unknown>;
  if (
    typeof record.account !== "string"
    || typeof record.action !== "string"
    || typeof record.bucket !== "string"
    || typeof record.eventTime !== "string"
    || typeof objectRecord.key !== "string"
    || typeof objectRecord.size !== "number"
    || !Number.isSafeInteger(objectRecord.size)
    || objectRecord.size < 0
  ) return null;

  return {
    account: record.account,
    action: record.action,
    bucket: record.bucket,
    eventTime: record.eventTime,
    object: {
      key: objectRecord.key,
      size: objectRecord.size,
      ...(typeof objectRecord.eTag === "string" && objectRecord.eTag ? { eTag: objectRecord.eTag.replace(/^\"|\"$/g, "") } : {}),
    },
  };
}
