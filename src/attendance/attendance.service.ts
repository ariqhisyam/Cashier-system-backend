import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import type { SafeUserProfile } from '../auth/auth.service';

export interface GeofenceConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
  addressName?: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Calculates distance in meters between two GPS coordinates using the Haversine formula
   */
  calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  /**
   * Helper to get start and end of today in WIB (UTC+7)
   */
  private getWibTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
    const wibDate = new Date(wibMs);
    const startWib = new Date(
      Date.UTC(
        wibDate.getUTCFullYear(),
        wibDate.getUTCMonth(),
        wibDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const startUtc = new Date(startWib.getTime() - 7 * 60 * 60 * 1000);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start: startUtc, end: endUtc };
  }

  /**
   * Process employee clock-in with geofence validation against outlet coordinates
   */
  async clockIn(dto: ClockInDto, user: SafeUserProfile) {
    if (!user || !user.id) {
      throw new BadRequestException('Pengguna tidak valid');
    }

    // 1. Fetch Geofencing Setting from DB
    let geofence: GeofenceConfig | null = null;
    const geofenceRow = await this.prisma.setting.findUnique({
      where: { key: 'geofence_setting' },
    });

    if (geofenceRow) {
      try {
        geofence = JSON.parse(geofenceRow.value) as GeofenceConfig;
      } catch {
        geofence = null;
      }
    }

    let distanceMeters = 0;

    // 2. Validate Geofencing boundary if enabled
    if (geofence && geofence.isEnabled) {
      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestException(
          'Lokasi GPS wajib diaktifkan untuk melakukan presensi masuk.',
        );
      }

      distanceMeters = this.calculateDistanceMeters(
        dto.latitude,
        dto.longitude,
        geofence.latitude,
        geofence.longitude,
      );

      // Add dynamic accuracy buffer (up to 50m) for indoor/cellular GPS drift
      const accuracyBuffer = Math.min(Math.max(0, dto.accuracy || 0), 50);
      const maxAllowedRadius = geofence.radiusMeters + accuracyBuffer;

      if (distanceMeters > maxAllowedRadius) {
        if (dto.notes && dto.notes.includes('[DARURAT]')) {
          this.logger.warn(
            `Clock-in darurat di luar radius oleh ${user.name}: ${distanceMeters}m (Catatan: ${dto.notes})`,
          );
        } else {
          throw new BadRequestException(
            `📍 Anda berada di luar area outlet (Jarak: ${distanceMeters}m dari toko). Batas radius presensi: ${geofence.radiusMeters}m.`,
          );
        }
      }
    }

    // 3. Check if there is already an active clock-in today without clock-out (in WIB day)
    const { start: todayStartWib } = this.getWibTodayRange();

    const existingActive = await this.prisma.attendance.findFirst({
      where: {
        userId: user.id,
        clockIn: { gte: todayStartWib },
        clockOut: null,
      },
    });

    if (existingActive) {
      return existingActive;
    }

    // 4. Create new attendance record
    const attendance = await this.prisma.attendance.create({
      data: {
        userId: user.id,
        userName: user.name,
        clockIn: new Date(),
        latitude: dto.latitude || null,
        longitude: dto.longitude || null,
        distanceMeters,
        notes: dto.notes || null,
      },
    });

    this.logger.log(
      `Clock-In recorded: ${user.name} | Distance: ${distanceMeters}m | ID: #${attendance.id}`,
    );

    return attendance;
  }

  /**
   * Process employee clock-out (e.g. on close shift or manual clock out)
   */
  async clockOut(dto: ClockOutDto, user: SafeUserProfile) {
    if (!user || !user.id) {
      throw new BadRequestException('Pengguna tidak valid');
    }

    let targetAttendanceId = dto.attendanceId;

    if (!targetAttendanceId) {
      const active = await this.prisma.attendance.findFirst({
        where: {
          userId: user.id,
          clockOut: null,
        },
        orderBy: { clockIn: 'desc' },
      });

      if (!active) {
        throw new BadRequestException(
          'Tidak ada sesi presensi masuk aktif yang dapat diakhiri.',
        );
      }
      targetAttendanceId = active.id;
    }

    const updated = await this.prisma.attendance.update({
      where: { id: targetAttendanceId },
      data: {
        clockOut: new Date(),
        ...(dto.notes && { notes: dto.notes }),
      },
    });

    this.logger.log(
      `Clock-Out recorded: ${user.name} | ID: #${updated.id}`,
    );

    return updated;
  }

  /**
   * Fetch currently active attendance for logged-in employee today
   */
  async getActive(user: SafeUserProfile) {
    if (!user || !user.id) return null;

    const { start: todayStartWib } = this.getWibTodayRange();

    return this.prisma.attendance.findFirst({
      where: {
        userId: user.id,
        clockIn: { gte: todayStartWib },
        clockOut: null,
      },
      orderBy: { clockIn: 'desc' },
    });
  }

  /**
   * Fetch paginated attendance records for Admin
   */
  async findAll(query?: AttendanceQueryDto) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const userId = query?.userId;
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query?.sortBy || 'clockIn';

    const where: Prisma.AttendanceWhereInput = {
      ...(userId && { userId }),
      ...(search && {
        OR: [
          { userName: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    if (query?.startDate || query?.endDate) {
      where.clockIn = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const [total, attendances] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      }),
    ]);

    return {
      attendances,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Delete attendance record by ID
   */
  async remove(id: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Catatan presensi #${id} tidak ditemukan`);
    }

    return this.prisma.attendance.delete({
      where: { id },
    });
  }
}
