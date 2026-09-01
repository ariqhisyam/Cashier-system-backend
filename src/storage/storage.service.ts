import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly supabaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://llyeovbymplgfalfxbrd.supabase.co';
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'Cashier-system-img';

    const endpoint =
      this.configService.get<string>('S3_ENDPOINT') ||
      `${this.supabaseUrl}/storage/v1/s3`;
    const region =
      this.configService.get<string>('S3_REGION') || 'ap-northeast-2';
    const accessKeyId =
      this.configService.get<string>('S3_ACCESS_KEY_ID') || '';
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_ACCESS_KEY') || '';

    this.s3Client = new S3Client({
      forcePathStyle: true,
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `Supabase S3 Storage Client initialized with Sharp WebP compression for bucket: "${this.bucketName}"`,
    );
  }

  /**
   * Optimizes & converts image to high-efficiency WebP, then uploads to Supabase Object Storage
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<{ url: string; path: string; bucket: string; filename: string; size: number; originalSize: number }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File tidak ditemukan dalam request');
    }

    // 1. Process & Convert Image to WebP using Sharp
    let processedBuffer: Buffer;
    const originalSize = file.size || file.buffer.length;

    try {
      processedBuffer = await sharp(file.buffer)
        .rotate() // Automatically correct EXIF orientation (e.g. mobile photo uploads)
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
          effort: 4, // Best balance between CPU speed and compression ratio
        })
        .toBuffer();
    } catch (err: any) {
      this.logger.error(`Failed to process/convert image with Sharp: ${err.message}`);
      throw new BadRequestException(
        'Format file yang diunggah tidak didukung atau bukan gambar yang valid.',
      );
    }

    const compressedSize = processedBuffer.length;
    const savedPercentage = (
      ((originalSize - compressedSize) / (originalSize || 1)) *
      100
    ).toFixed(1);

    // 2. Cryptographically secure WebP filename
    const uniqueId = crypto.randomUUID();
    const cleanFileName = `${uniqueId}.webp`;

    // 3. Sanitize folder path
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'products';
    const filePath = `${sanitizedFolder}/${cleanFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: processedBuffer,
        ContentType: 'image/webp',
      });

      await this.s3Client.send(command);

      const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${filePath}`;

      this.logger.log(
        `WebP image uploaded successfully: "${filePath}" | Original: ${(originalSize / 1024).toFixed(1)} KB -> WebP: ${(compressedSize / 1024).toFixed(1)} KB (${savedPercentage}% smaller)`,
      );

      return {
        url: publicUrl,
        path: filePath,
        bucket: this.bucketName,
        filename: cleanFileName,
        size: compressedSize,
        originalSize,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to upload WebP image via S3 protocol: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Gagal mengupload file ke storage: ${error.message}`,
      );
    }
  }

  /**
   * Get public URL for an existing file in bucket
   */
  getPublicUrl(filePath: string): string {
    const sanitizedPath = filePath.replace(/^\/+/, '');
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${sanitizedPath}`;
  }

  /**
   * Extract storage path from a full public Supabase Storage URL
   * e.g. "https://llyeovbymplgfalfxbrd.supabase.co/storage/v1/object/public/Cashier-system-img/products/123.webp"
   * -> "products/123.webp"
   */
  extractKeyFromUrl(url?: string | null): string | null {
    if (!url) return null;
    const bucketPattern = new RegExp(
      `/storage/v1/object/public/${this.bucketName}/(.+)`,
    );
    const match = url.match(bucketPattern);
    if (match && match[1]) {
      return match[1];
    }
    if (url.startsWith('products/') || url.startsWith('qris/')) {
      return url;
    }
    return null;
  }

  /**
   * Delete file from bucket using S3 protocol
   */
  async deleteFile(filePath: string): Promise<boolean> {
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: sanitizedPath,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully from Supabase Storage via S3: ${sanitizedPath}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to delete file via S3 protocol: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Gagal menghapus file dari storage: ${error.message}`,
      );
    }
  }

  /**
   * Safely deletes file by public URL or storage path if it resides in the storage bucket
   */
  async deleteFileByUrl(url?: string | null): Promise<boolean> {
    if (!url) return false;
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      // Local placeholder image or external URL, no storage delete needed
      return false;
    }

    try {
      await this.deleteFile(key);
      return true;
    } catch (error: any) {
      this.logger.warn(`Could not delete storage file "${key}": ${error.message}`);
      return false;
    }
  }
}
