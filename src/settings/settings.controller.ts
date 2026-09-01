import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SaveQrisDto, SetSettingDto } from './dto/save-setting.dto';
import { SaveGeofenceDto } from './dto/geofence-setting.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll() {
    const settings = await this.settingsService.getAllSettings();
    return {
      message: 'Berhasil mengambil data pengaturan',
      data: settings,
    };
  }

  @Get('qris')
  async getQris() {
    const imageUrl = await this.settingsService.getQrisImageUrl();
    return {
      message: 'Berhasil mengambil URL QRIS',
      data: {
        imageUrl,
      },
    };
  }

  @Post('qris')
  async saveQris(@Body() body: SaveQrisDto) {
    const result = await this.settingsService.setQrisImageUrl(body.imageUrl);
    return {
      message: 'URL QRIS berhasil disimpan',
      data: result,
    };
  }

  @Get('geofence')
  async getGeofence() {
    const geofence = await this.settingsService.getGeofenceSetting();
    return {
      message: 'Berhasil mengambil konfigurasi geofencing',
      data: geofence,
    };
  }

  @Post('geofence')
  async saveGeofence(@Body() body: SaveGeofenceDto) {
    const result = await this.settingsService.setGeofenceSetting(body);
    return {
      message: 'Konfigurasi geofencing berhasil disimpan',
      data: result,
    };
  }

  @Get(':key')
  async getByKey(@Param('key') key: string) {
    const value = await this.settingsService.getSetting(key);
    return {
      message: `Berhasil mengambil setting ${key}`,
      data: { key, value },
    };
  }

  @Post()
  async setSetting(@Body() body: SetSettingDto) {
    const result = await this.settingsService.setSetting(body.key, body.value);
    return {
      message: `Setting ${body.key} berhasil disimpan`,
      data: result,
    };
  }
}
