import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;

  const mockPrisma: any = {
    setting: {
      findUnique: jest.fn(),
    },
    attendance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockTelegramService: any = {
    sendTransactionNotification: jest.fn().mockResolvedValue(true),
    sendShiftCloseNotification: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    service = new AttendanceService(mockPrisma, mockTelegramService);
    jest.clearAllMocks();
  });

  describe('calculateDistanceMeters', () => {
    it('should calculate distance accurately between two coordinates', () => {
      // Monas to Gambir station (~800m)
      const dist = service.calculateDistanceMeters(
        -6.1754,
        106.8272,
        -6.1767,
        106.8306,
      );
      expect(dist).toBeGreaterThan(300);
      expect(dist).toBeLessThan(600);
    });
  });

  describe('clockIn', () => {
    it('should successfully clock in within geofence radius', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({
        key: 'geofence_setting',
        value: JSON.stringify({
          latitude: -6.1754,
          longitude: 106.8272,
          radiusMeters: 500,
          isEnabled: true,
        }),
      });

      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'att-1',
        userId: 'usr-1',
        userName: 'kuylaa',
        clockIn: new Date(),
        distanceMeters: 50,
      });

      const user = { id: 'usr-1', name: 'kuylaa', role: 'KARYAWAN' };
      const result = await service.clockIn(
        { latitude: -6.1755, longitude: 106.8273 },
        user,
      );

      expect(mockPrisma.attendance.create).toHaveBeenCalled();
      expect(result.id).toBe('att-1');
    });

    it('should throw BadRequestException if employee is outside geofence radius', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({
        key: 'geofence_setting',
        value: JSON.stringify({
          latitude: -6.1754,
          longitude: 106.8272,
          radiusMeters: 100, // 100m
          isEnabled: true,
        }),
      });

      const user = { id: 'usr-1', name: 'kuylaa', role: 'KARYAWAN' };
      // Coordinate far away (~50km)
      await expect(
        service.clockIn({ latitude: -6.595, longitude: 106.8166 }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing active clock-in if already clocked in today', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      const existing = {
        id: 'att-existing',
        userId: 'usr-1',
        clockIn: new Date(),
        clockOut: null,
      };
      mockPrisma.attendance.findFirst.mockResolvedValue(existing);

      const user = { id: 'usr-1', name: 'kuylaa', role: 'KARYAWAN' };
      const result = await service.clockIn({}, user);

      expect(result.id).toBe('att-existing');
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });
  });

  describe('clockOut', () => {
    it('should successfully clock out an active attendance session', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: 'att-1',
        userId: 'usr-1',
        clockOut: null,
      });
      mockPrisma.attendance.update.mockResolvedValue({
        id: 'att-1',
        clockOut: new Date(),
      });

      const user = { id: 'usr-1', name: 'kuylaa', role: 'KARYAWAN' };
      const result = await service.clockOut({}, user);

      expect(mockPrisma.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({ clockOut: expect.any(Date) }),
        }),
      );
      expect(result.clockOut).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if attendance record does not exist', async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
