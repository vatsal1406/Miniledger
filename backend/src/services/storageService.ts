import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface UploadResult {
  url: string;
  publicId: string;
  sizeBytes: number;
  mimeType: string;
  originalFilename?: string;
  isMock: boolean;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class StorageService {
  private isConfigured = false;
  private isProduction = process.env['NODE_ENV'] === 'production';
  private localUploadsDir: string;

  constructor() {
    this.localUploadsDir = path.resolve(process.cwd(), 'uploads', 'receipts');

    const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
    const apiKey = process.env['CLOUDINARY_API_KEY'];
    const apiSecret = process.env['CLOUDINARY_API_SECRET'];

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      console.log('✅ Cloudinary storage service initialized successfully.');
    } else {
      if (this.isProduction) {
        console.warn('⚠️  Cloudinary credentials missing in production environment.');
      } else {
        console.log('ℹ️  No Cloudinary credentials provided. Operating local receipt storage for development.');
      }
      // Ensure local uploads directory exists
      if (!fs.existsSync(this.localUploadsDir)) {
        fs.mkdirSync(this.localUploadsDir, { recursive: true });
      }
    }
  }

  public validateFile(mimeType: string, sizeBytes: number): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}. Allowed formats: JPEG, PNG, WebP, HEIC.`);
    }

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
      throw new Error(`File size (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${maxMb}MB.`);
    }
  }

  public async uploadReceipt(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<UploadResult> {
    this.validateFile(mimeType, buffer.length);

    if (this.isConfigured) {
      return new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'miniledger/receipts',
            resource_type: 'image',
          },
          (error, result) => {
            if (error || !result) {
              return reject(new Error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`));
            }
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              sizeBytes: result.bytes || buffer.length,
              mimeType,
              originalFilename,
              isMock: false,
            });
          }
        );

        uploadStream.end(buffer);
      });
    }

    if (this.isProduction) {
      throw new Error(
        'Cloudinary credentials required in production. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      );
    }

    // Local file storage in development
    const ext = path.extname(originalFilename) || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(this.localUploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Return relative API URL served by Express
    const url = `/api/receipts/file/${filename}`;

    console.warn(`[STORAGE NOTICE] Saved receipt locally to ${filePath} (Cloudinary not configured in .env).`);

    return {
      url,
      publicId: `local:${filename}`,
      sizeBytes: buffer.length,
      mimeType,
      originalFilename,
      isMock: true,
    };
  }

  public async deleteReceipt(publicId: string): Promise<void> {
    if (!publicId) return;

    if (publicId.startsWith('local:')) {
      const filename = publicId.replace('local:', '');
      const filePath = path.join(this.localUploadsDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('Failed to delete local receipt file:', err);
        }
      }
      return;
    }

    if (this.isConfigured) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn('Failed to delete asset from Cloudinary:', err);
      }
    }
  }
}

export const storageService = new StorageService();
