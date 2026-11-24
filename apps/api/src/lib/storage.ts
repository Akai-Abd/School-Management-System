import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { Errors } from './errors.js';

export interface StoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageDownloadResult {
  kind: 'stream' | 'signedUrl';
  url?: string;
  buffer?: Buffer;
}

export interface StorageAdapter {
  readonly provider: 'local' | 's3';
  putObject(input: StoragePutInput): Promise<void>;
  getDownload(key: string): Promise<StorageDownloadResult>;
  deleteObject(key: string): Promise<void>;
}

const ALLOWED_SIGNATURES: Array<{ mime: string; check: (buf: Buffer) => boolean }> = [
  {
    mime: 'image/png',
    check: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/jpeg',
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'application/pdf',
    check: (b) => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

/** Validates allowed file types by inspecting magic bytes (blocks SVG/HTML/executables). */
export function detectAllowedMime(buffer: Buffer): string {
  for (const sig of ALLOWED_SIGNATURES) {
    if (sig.check(buffer)) return sig.mime;
  }
  throw Errors.badRequest('Unsupported or unsafe file type. Allowed: PNG, JPEG, WebP, PDF');
}

export function buildStorageKey(schoolId: string, mimeType: string): string {
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1] ?? 'bin';
  return `${schoolId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local' as const;
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(this.rootDir + path.sep)) {
      throw Errors.badRequest('Invalid storage key');
    }
    return resolved;
  }

  async putObject(input: StoragePutInput): Promise<void> {
    const target = this.resolveSafePath(input.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.body);
  }

  async getDownload(key: string): Promise<StorageDownloadResult> {
    const target = this.resolveSafePath(key);
    const buffer = await fs.readFile(target);
    return { kind: 'stream', buffer };
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolveSafePath(key);
    await fs.rm(target, { force: true });
  }
}

export class S3StorageAdapter implements StorageAdapter {
  readonly provider = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET ?? '';
    this.client = new S3Client({
      region: env.S3_REGION ?? 'ap-south-1',
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async putObject(input: StoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getDownload(key: string): Promise<StorageDownloadResult> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 300 },
    );
    return { kind: 'signedUrl', url };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export function createStorageAdapter(): StorageAdapter {
  return env.STORAGE_DRIVER === 's3'
    ? new S3StorageAdapter()
    : new LocalStorageAdapter(env.LOCAL_STORAGE_DIR);
}
