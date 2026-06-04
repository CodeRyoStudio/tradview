import protobuf from 'protobufjs';
import {
  PROTO_WS_ENVELOPE_BODY_TYPE_MAP,
  type ProtoWsEnvelopeBodyArm,
} from './proto-schema.js';
import type { Envelope } from '../types.js';

/** Negotiated when `encoding: 'json'` (default). */
export const WS_SUBPROTOCOL_JSON = 'tradview-json';

/** Negotiated when `encoding: 'protobuf'`. */
export const WS_SUBPROTOCOL_PROTOBUF = 'tradview-protobuf';

const protoUrl = new URL('../../proto/tradview.proto', import.meta.url);

const TYPE_TO_ARM = Object.fromEntries(
  Object.entries(PROTO_WS_ENVELOPE_BODY_TYPE_MAP).map(([arm, type]) => [type, arm]),
) as Record<string, ProtoWsEnvelopeBodyArm>;

const PROTO_TO_OBJECT_OPTS: protobuf.IConversionOptions = {
  longs: Number,
  enums: String,
  defaults: false,
  oneofs: true,
};

/** protobufjs JS property name for a proto oneof arm (snake_case → camelCase). */
function protoArmToJsKey(arm: ProtoWsEnvelopeBodyArm): string {
  return arm.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function stripProtobufJsAliases<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => stripProtobufJsAliases(item)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('_')) continue;
    out[key] = stripProtobufJsAliases(v);
  }
  return out as T;
}

let envelopeTypePromise: Promise<protobuf.Type> | null = null;

async function loadProtoRoot(): Promise<protobuf.Root> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { fileURLToPath } = await import('node:url');
    return protobuf.load(fileURLToPath(protoUrl));
  }
  return protobuf.load(protoUrl.href);
}

function getEnvelopeType(): Promise<protobuf.Type> {
  if (!envelopeTypePromise) {
    envelopeTypePromise = loadProtoRoot().then((root) => {
      const type = root.lookupType('tradview.ws.Envelope');
      if (!type) throw new Error('tradview.ws.Envelope not found in tradview.proto');
      return type;
    });
  }
  return envelopeTypePromise;
}

function armForWsType(type: string): ProtoWsEnvelopeBodyArm {
  const arm = TYPE_TO_ARM[type];
  if (!arm) {
    throw new Error(`Unsupported WS type for protobuf codec: ${type}`);
  }
  return arm;
}

function activeBodyArm(obj: Record<string, unknown>): ProtoWsEnvelopeBodyArm | null {
  for (const arm of Object.keys(PROTO_WS_ENVELOPE_BODY_TYPE_MAP) as ProtoWsEnvelopeBodyArm[]) {
    const jsKey = protoArmToJsKey(arm);
    if (obj[jsKey] !== undefined && obj[jsKey] !== null) return arm;
  }
  return null;
}

function jsonEnvelopeToProtoRecord(envelope: Envelope): Record<string, unknown> {
  const arm = armForWsType(envelope.type);
  const record: Record<string, unknown> = {
    v: envelope.v,
    type: envelope.type,
    [protoArmToJsKey(arm)]: envelope.payload ?? {},
  };
  if (envelope.id !== undefined) record.id = envelope.id;
  if (envelope.ts !== undefined) record.ts = envelope.ts;
  return record;
}

/**
 * Encode a JSON-shaped WS `Envelope` to `tradview.ws.Envelope` bytes.
 */
export async function encodeWsProtobufEnvelope(envelope: Envelope): Promise<Uint8Array> {
  const EnvelopeType = await getEnvelopeType();
  const protoRecord = jsonEnvelopeToProtoRecord(envelope);
  const err = EnvelopeType.verify(protoRecord);
  if (err) throw new Error(`protobuf verify: ${err}`);
  const message = EnvelopeType.create(protoRecord);
  return EnvelopeType.encode(message).finish();
}

/**
 * Decode `tradview.ws.Envelope` bytes to JSON-shaped `Envelope<T>` (camelCase payload).
 */
export async function decodeWsProtobufEnvelope(bytes: Uint8Array): Promise<Envelope> {
  const EnvelopeType = await getEnvelopeType();
  const decoded = EnvelopeType.decode(bytes);
  const obj = EnvelopeType.toObject(decoded, PROTO_TO_OBJECT_OPTS) as Record<string, unknown>;

  const arm = activeBodyArm(obj);
  const type =
    arm != null
      ? PROTO_WS_ENVELOPE_BODY_TYPE_MAP[arm]
      : typeof obj.type === 'string'
        ? obj.type
        : '';

  const payload =
    arm != null
      ? stripProtobufJsAliases(obj[protoArmToJsKey(arm)] ?? {})
      : {};

  return {
    v: String(obj.v ?? '1.0'),
    id: obj.id !== undefined && obj.id !== '' ? String(obj.id) : undefined,
    type,
    ts: obj.ts !== undefined ? Number(obj.ts) : undefined,
    payload,
  };
}

/** Reset cached proto root (tests only). */
export function resetWsProtobufCodecForTests(): void {
  envelopeTypePromise = null;
}