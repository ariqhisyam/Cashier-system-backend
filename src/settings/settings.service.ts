import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async setQrisImageUrl(imageUrl: string) {
    return this.setSetting('qris_image_url', imageUrl);
  }
}
