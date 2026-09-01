import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://llyeovbymplgfalfxbrd.supabase.co';
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY') || '';
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'Cashier-system-img';

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      this.logger.log(
        `Supabase Storage client initialized for bucket: "${this.bucketName}"`,
      );
    } else {
      this.logger.warn(
        `SUPABASE_KEY is not configured in .env. Storage upload operations will be unavailable until set.`,
      );
    }
  }

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl =
        this.configService.get<string>('SUPABASE_URL') ||
        'https://llyeovbymplgfalfxbrd.supabase.co';
      const supabaseKey = this.configService.get<string>('SUPABASE_KEY') || '';
      if (!supabaseKey) {
        throw new BadRequestException(
          'Supabase API Key (SUPABASE_KEY) belum diatur pada .env. Silakan lengkapi SUPABASE_KEY untuk menggunakan Object Storage.',
        );
      }
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    }
    return this.supabase;
  }

  /**
   * Upload file to Supabase Object Storage bucket with cryptographically secure random filename
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<{ url: string; path: string; bucket: string; filename: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File tidak ditemukan dalam request');
    }

    const client = this.getClient();

    // Map MIME type or sanitize file extension
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
    };

    const rawExt = path.extname(file.originalname).replace('.', '').toLowerCase();
    const ext = mimeToExt[file.mimetype] || rawExt || 'jpg';

    // Cryptographically secure filename
    const uniqueId = crypto.randomUUID();
    const cleanFileName = `${uniqueId}.${ext}`;

    // Sanitize folder path (prevent directory traversal)
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'products';
    const filePath = `${sanitizedFolder}/${cleanFileName}`;

    const { data, error } = await client.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(
        `Failed to upload file to Supabase Storage: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Gagal mengupload file ke storage: ${error.message}`,
      );
    }

    const { data: publicUrlData } = client.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      bucket: this.bucketName,
      filename: cleanFileName,
    };
  }

  /**
   * Get public URL for an existing file in bucket
   */
  getPublicUrl(filePath: string): string {
    const client = this.getClient();
    const { data } = client.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * Delete file from bucket
   */
  async deleteFile(filePath: string): Promise<boolean> {
    const client = this.getClient();
    // Sanitize path
    const sanitizedPath = filePath.replace(/\.\./g, '');
    const { error } = await client.storage
      .from(this.bucketName)
      .remove([sanitizedPath]);

    if (error) {
      this.logger.error(
        `Failed to delete file from Supabase Storage: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Gagal menghapus file dari storage: ${error.message}`,
      );
    }

    return true;
  }
}
