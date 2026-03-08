import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { RDSClient, RestoreDBClusterToPointInTimeCommand } from '@aws-sdk/client-rds';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// SECURITY: Validate filenames to prevent path traversal and command injection
const SAFE_FILENAME_RE = /^backup-[\dT:.Z-]+\.sql\.gz$/;

export class BackupService {
  private s3: S3Client;
  private rds: RDSClient;

  constructor() {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.rds = new RDSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async createDatabaseBackup(): Promise<string> {
    const timestamp = new Date().toISOString();
    const filename = `backup-${timestamp}.sql.gz`;

    // SECURITY: Use execFile with explicit args to prevent shell injection via DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not configured');
    await execFileAsync('/bin/sh', ['-c', 'pg_dump "$DB_URL" | gzip > "$OUT_FILE"'], {
      env: { ...process.env, DB_URL: dbUrl, OUT_FILE: `/tmp/${filename}` },
    });

    const fileContent = await fs.readFile(`/tmp/${filename}`);

    await this.s3.send(new PutObjectCommand({
      Bucket: process.env.BACKUP_BUCKET || 'twinmcp-backups',
      Key: `database/${filename}`,
      Body: fileContent,
      StorageClass: 'GLACIER_IR'
    }));

    await this.replicateToRegions(filename, fileContent);

    await fs.unlink(`/tmp/${filename}`);

    return filename;
  }

  async restoreFromBackup(filename: string): Promise<void> {
    // SECURITY: Validate filename to prevent path traversal and command injection
    if (!SAFE_FILENAME_RE.test(filename)) {
      throw new Error('Invalid backup filename format');
    }

    const response = await this.s3.send(new GetObjectCommand({
      Bucket: process.env.BACKUP_BUCKET || 'twinmcp-backups',
      Key: `database/${filename}`
    }));

    if (!response.Body) {
      throw new Error('Backup file not found');
    }

    const fileContent = await response.Body.transformToByteArray();
    await fs.writeFile(`/tmp/${filename}`, fileContent);

    // SECURITY: Use execFile with explicit args to prevent shell injection
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not configured');
    await execFileAsync('/bin/sh', ['-c', 'gunzip < "$IN_FILE" | psql "$DB_URL"'], {
      env: { ...process.env, DB_URL: dbUrl, IN_FILE: `/tmp/${filename}` },
    });

    await fs.unlink(`/tmp/${filename}`);
  }

  async createPointInTimeRecovery(timestamp: Date): Promise<void> {
    await this.rds.send(new RestoreDBClusterToPointInTimeCommand({
      SourceDBClusterIdentifier: process.env.DB_CLUSTER_ID,
      TargetDBClusterIdentifier: `${process.env.DB_CLUSTER_ID}-pitr`,
      RestoreToTime: timestamp,
      UseLatestRestorableTime: false
    } as any));
  }

  async listBackups(): Promise<string[]> {
    return [];
  }

  async deleteOldBackups(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  }

  private async replicateToRegions(filename: string, content: Buffer): Promise<void> {
    const regions = ['eu-west-1', 'ap-southeast-1'];

    for (const region of regions) {
      const s3Regional = new S3Client({ region });
      
      await s3Regional.send(new PutObjectCommand({
        Bucket: `twinmcp-backups-${region}`,
        Key: `database/${filename}`,
        Body: content,
        StorageClass: 'GLACIER_IR'
      }));
    }
  }
}
