import { prisma } from "../config/database";
import { env } from "../config/env";
import fs from "fs";
import path from "path";

/**
 * Backup Service — inicialmente local, preparado para GDrive/S3/OneDrive
 * Interface desacoplada para trocar provedor sem alterar código
 */
export interface BackupProvider {
  save(filename: string, data: Buffer): Promise<string>;
  list(): Promise<string[]>;
  delete(filename: string): Promise<void>;
}

class LocalBackupProvider implements BackupProvider {
  private dir: string;

  constructor() {
    this.dir = env.BACKUP_DIR;
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  async save(filename: string, data: Buffer): Promise<string> {
    const filepath = path.join(this.dir, filename);
    fs.writeFileSync(filepath, data);
    return filepath;
  }

  async list(): Promise<string[]> {
    return fs.readdirSync(this.dir);
  }

  async delete(filename: string): Promise<void> {
    const filepath = path.join(this.dir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

// TODO: Implementar quando necessário
// class GDriveBackupProvider implements BackupProvider { ... }
// class S3BackupProvider implements BackupProvider { ... }
// class OneDriveBackupProvider implements BackupProvider { ... }

export class BackupService {
  private provider: BackupProvider;

  constructor(provider?: BackupProvider) {
    this.provider = provider || new LocalBackupProvider(); // DI — troca fácil
  }

  /** Backup completo do banco SQLite */
  async createFullBackup(tenantId: string): Promise<{ filename: string; size: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `kairos-backup-${tenantId}-${timestamp}.db`;

    // SQLite: copia o arquivo do banco
    const dbPath = env.DATABASE_URL.replace("file:", "");
    const data = fs.readFileSync(dbPath);
    const savedPath = await this.provider.save(filename, data);
    const size = data.length;

    // Registra no banco
    await prisma.backup.create({
      data: { tenantId, filename, size, type: "local", path: savedPath },
    });

    return { filename, size };
  }

  /** Lista backups de um tenant */
  async listBackups(tenantId: string) {
    return prisma.backup.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Restaura um backup */
  async restoreBackup(backupId: string, tenantId: string) {
    const backup = await prisma.backup.findFirst({
      where: { id: backupId, tenantId, deletedAt: null },
    });

    if (!backup) throw new Error("Backup não encontrado");
    if (!backup.path || !fs.existsSync(backup.path))
      throw new Error("Arquivo de backup não encontrado");

    // SQLite: substitui o arquivo do banco
    const dbPath = env.DATABASE_URL.replace("file:", "");
    fs.copyFileSync(backup.path, dbPath);

    return { message: "Backup restaurado com sucesso" };
  }
}