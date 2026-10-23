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

    const cloudName = process.env['CLOUDINARY_CLOUD_NAME']?.trim();
    const apiKey = process.env['CLOUDINARY_API_KEY']?.trim();
    const apiSecret = process.env['CLOUDINARY_API_SECRET']?.trim();

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      console.log('✅ Cloudinary storage service initialized successfully (authenticated receipt mode).');
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

  public isReady(): boolean {
    return this.isConfigured;
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

  /**
   * Generates a signed, authenticated delivery URL for private receipt assets.
   * Direct unauthenticated access without the cryptographic signature returns 401 Unauthorized.
   */
  public getSignedUrl(publicId: string): string {
    if (!this.isConfigured || !publicId || publicId.startsWith('local:')) {
      return '';
    }
    return cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
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
            type: 'authenticated', // Secure access: not publicly accessible without HMAC signature
          },
          (error, result) => {
            if (error || !result) {
              return reject(new Error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`));
            }
            // Generate cryptographically signed delivery URL
            const signedUrl = this.getSignedUrl(result.public_id) || result.secure_url;
            resolve({
              url: signedUrl,
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
        'Cloudinary credentials required in production. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.'
      );
    }

    // Local file storage in development when Cloudinary is unconfigured
    const ext = path.extname(originalFilename) || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(this.localUploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

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
        // Authenticated assets require type: 'authenticated' for deletion
        const res = await cloudinary.uploader.destroy(publicId, { type: 'authenticated' });
        if (res.result !== 'ok') {
          // Fallback for any legacy assets uploaded without authenticated type
          await cloudinary.uploader.destroy(publicId, { type: 'upload' });
        }
      } catch (err) {
        console.warn('Failed to delete asset from Cloudinary:', err);
      }
    }
  }
}

export const storageService = new StorageService();
