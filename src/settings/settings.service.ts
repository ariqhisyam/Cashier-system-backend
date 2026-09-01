import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getSetting(key: string, defaultValue = ''): Promise<string> {
    const record = await this.prisma.setting.findUnique({
      where: { key },
    });
    return record ? record.value : defaultValue;
  }

  async setSetting(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getAllSettings() {
    return this.prisma.setting.findMany();
  }

  async getQrisImageUrl(): Promise<string> {
    return this.getSetting('qris_image_url', '/qris.jpg');
  }

  /**
   * Updates QRIS image URL and automatically deletes old image from Supabase Object Storage
   */
  async setQrisImageUrl(newImageUrl: string) {
    const oldImageUrl = await this.getQrisImageUrl();

    // If QRIS image URL is being changed to a new image, delete old file from storage
    if (oldImageUrl && oldImageUrl !== newImageUrl && oldImageUrl !== '/qris.jpg') {
      this.logger.log(`Replacing QRIS image. Deleting old storage file: ${oldImageUrl}`);
      await this.storageService.deleteFileByUrl(oldImageUrl);
    }

    return this.setSetting('qris_image_url', newImageUrl);
  }

  /**
   * Get outlet geofencing configuration
   */
  async getGeofenceSetting() {
    const defaultGeofence = {
      latitude: -0.02633,
      longitude: 109.342503,
      radiusMeters: 100,
      isEnabled: true,
      addressName: 'Outlet 4rq Cashier - Pontianak',
    };

    const raw = await this.getSetting('geofence_setting', '');
    if (!raw) return defaultGeofence;

    try {
      const parsed = JSON.parse(raw);
      return {
        latitude: typeof parsed.latitude === 'number' ? parsed.latitude : defaultGeofence.latitude,
        longitude: typeof parsed.longitude === 'number' ? parsed.longitude : defaultGeofence.longitude,
        radiusMeters: typeof parsed.radiusMeters === 'number' ? parsed.radiusMeters : defaultGeofence.radiusMeters,
        isEnabled: typeof parsed.isEnabled === 'boolean' ? parsed.isEnabled : defaultGeofence.isEnabled,
        addressName: parsed.addressName || defaultGeofence.addressName,
      };
    } catch {
      return defaultGeofence;
    }
  }

  /**
   * Save outlet geofencing configuration
   */
  async setGeofenceSetting(data: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    isEnabled: boolean;
    addressName: string;
  }) {
    const jsonStr = JSON.stringify({
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      radiusMeters: Number(data.radiusMeters),
      isEnabled: Boolean(data.isEnabled),
      addressName: data.addressName.trim(),
    });

    await this.setSetting('geofence_setting', jsonStr);
    return this.getGeofenceSetting();
  }
}
