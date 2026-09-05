import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwt: any = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockConfig: any = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      return null;
    }),
  };

  beforeEach(() => {
    service = new AuthService(mockPrisma, mockJwt, mockConfig);
    jest.clearAllMocks();
  });

  describe('validateUserByKey', () => {
    it('should successfully validate an active user by key', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr-123',
        name: 'Admin Matcha',
        role: 'ADMIN',
        isActive: true,
      });

      const result = await service.validateUserByKey('admin123');
      expect(result).toEqual({
        id: 'usr-123',
        name: 'Admin Matcha',
        role: 'ADMIN',
        monthlySalary: 0,
      });
      // Ensure key is NOT returned in the result
      expect((result as any).key).toBeUndefined();
    });

    it('should throw UnauthorizedException when key is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUserByKey('invalid-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr-456',
        name: 'Inactive User',
        role: 'KARYAWAN',
        isActive: false,
      });

      await expect(service.validateUserByKey('inactive123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user role does not match expected role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr-789',
        name: 'Kasir Kyoto',
        role: 'KARYAWAN',
        isActive: true,
      });

      // User has role KARYAWAN but tried to login as ADMIN
      await expect(
        service.validateUserByKey('kyoto123', 'ADMIN'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should sign minimal JWT payload { sub: user.id } and set HttpOnly cookie', async () => {
      const mockRes: any = {
        cookie: jest.fn(),
      };

      const user = { id: 'usr-123', name: 'Admin Matcha', role: 'ADMIN' };
      const result = await service.login(user, mockRes);

      expect(mockJwt.sign).toHaveBeenCalledWith({ sub: 'usr-123' });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
      expect(result).toEqual({
        ...user,
        token: 'mock-jwt-token',
      });
    });
  });

  describe('logout', () => {
    it('should clear the access_token HttpOnly cookie', async () => {
      const mockRes: any = {
        clearCookie: jest.fn(),
      };

      const result = await service.logout(mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
