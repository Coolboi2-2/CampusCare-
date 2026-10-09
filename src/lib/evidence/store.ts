import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_IMAGE_BYTES, fetchImageBytes } from '../ai/image';
import { sha256Hex, readImageInfo, differenceHash, perceptualDistance, PERCEPTUAL_DUPLICATE_THRESHOLD } from './fingerprint';
import type { EvidenceRecord, EvidenceType, ReuseMatch } from './types';

export interface IngestActor {
  name: string;
  role: string;
}

export interface IngestOptions {
  /**
   * Shared content hash supplied by the trusted caller only (e.g. base64 body
   * decoded and hashed in the same process). Never taken from client JSON.
   */
  readonly?: boolean;
}

/**
 * Immutable evidence store.
 *
 * Bytes received by the trusted server are written once to controlled storage
 * and addressed by a stable key. All fingerprints are computed server-side from
 * the received bytes; nothing is trusted from the client.
 *
 * The in-memory index supports the demo (tickets are also in-memory). For a
 * real deployment this index is the piece that becomes a DB table with an
 * index on sha256; the interface stays the same.
 */
export class EvidenceStore {
  private dir: string;
  private records = new Map<string, EvidenceRecord>();
  private bytesCache = new Map<string, Buffer>();
  private bySha = new Map<string, string[]>();

  constructor(dir: string = process.env.EVIDENCE_DIR || path.join(process.cwd(), '.data', 'evidence')) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  get storageDir(): string {
    return this.dir;
  }

  /** Ingest raw bytes received by the server (base64 decode, multipart, etc.). */
  async ingestBytes(
    ticketId: string,
    type: EvidenceType,
    bytes: Buffer,
    actor: IngestActor
  ): Promise<EvidenceRecord> {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new Error('Empty evidence file');
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error('Evidence exceeds the 8MB limit');
    }

    // Defensive copy: preserve exactly what the server received, even if the
    // caller reuses or mutates its source buffer afterwards.
    const stored = Buffer.from(bytes);

    // Decode to prove it is a real, supported image rather than trusting the
    // filename/extension/client MIME type.
    const info = await readImageInfo(stored);
    const sha256 = sha256Hex(stored);
    const dHash = await differenceHash(stored);
    const dHashMirrored = await differenceHash(stored, true);

    const id = `ev-${type}-${randomUUID()}`;
    const storageKey = path.join(this.dir, id);
    fs.writeFileSync(storageKey, stored, { mode: 0o600 });

    const record: EvidenceRecord = {
      id,
      ticketId,
      type,
      actor: actor.name,
      actorRole: actor.role,
      receivedAt: new Date().toISOString(),
      storageKey,
      status: 'stored',
      sha256,
      dHash,
      dHashMirrored,
      width: info.width,
      height: info.height,
      format: info.format,
      bytes: bytes.length,
    };

    this.records.set(id, record);
    this.bytesCache.set(id, stored);
    const existing = this.bySha.get(sha256) || [];
    existing.push(id);
    this.bySha.set(sha256, existing);
    return record;
  }

  /** Fetch an external URL once, then preserve the bytes like any upload. */
  async ingestFromUrl(
    ticketId: string,
    type: EvidenceType,
    url: string,
    actor: IngestActor
  ): Promise<EvidenceRecord> {
    const { bytes } = await fetchImageBytes(url);
    return this.ingestBytes(ticketId, type, bytes, actor);
  }

  get(id: string): EvidenceRecord | undefined {
    return this.records.get(id);
  }

  /** Bytes previously received by the server (falls back to disk if needed). */
  getBytes(id: string): Buffer | undefined {
    const cached = this.bytesCache.get(id);
    if (cached) return cached;
    const record = this.records.get(id);
    if (!record) return undefined;
    try {
      return fs.readFileSync(record.storageKey);
    } catch {
      return undefined;
    }
  }

  getByTicket(ticketId: string): EvidenceRecord[] {
    return Array.from(this.records.values()).filter((r) => r.ticketId === ticketId);
  }

  /**
   * Find exact and perceptual reuse of `record` against all preserved evidence.
   * Returns raw matches; policy decides severity (cross-ticket vs same scene).
   */
  findReuse(record: EvidenceRecord): ReuseMatch[] {
    const matches: ReuseMatch[] = [];

    for (const otherId of this.bySha.get(record.sha256) || []) {
      if (otherId === record.id) continue;
      const other = this.records.get(otherId);
      if (!other) continue;
      matches.push({
        type: 'exact',
        evidenceId: other.id,
        ticketId: other.ticketId,
        evidenceType: other.type,
        similarity: 0,
      });
    }

    for (const other of this.records.values()) {
      if (other.id === record.id) continue;
      if (other.sha256 === record.sha256) continue; // already reported as exact
      const distance = perceptualDistance(record, other);
      if (distance === null) continue;
      if (distance <= PERCEPTUAL_DUPLICATE_THRESHOLD) {
        matches.push({
          type: 'perceptual',
          evidenceId: other.id,
          ticketId: other.ticketId,
          evidenceType: other.type,
          similarity: distance,
        });
      }
    }

    return matches;
  }

  markFlagged(id: string): void {
    const record = this.records.get(id);
    if (record) record.status = 'flagged';
  }

  reset(): void {
    this.records.clear();
    this.bytesCache.clear();
    this.bySha.clear();
  }

  get size(): number {
    return this.records.size;
  }
}
