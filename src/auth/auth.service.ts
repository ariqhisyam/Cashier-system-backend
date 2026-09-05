import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

import { Role } from '../common/enums';

export interface SafeUserProfile {
  id: string;
  name: string;
  role: string;
  monthlySalary?: number;
  token?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Validates access key against users database and optionally matches expected role.
   */
  async validateUserByKey(key: string, expectedRole?: Role | string): Promise<SafeUserProfile> {
    if (!key || typeof key !== 'string') {
      throw new UnauthorizedException('Kunci akses tidak valid atau akun tidak aktif');
    }

    const user = await this.prisma.user.findUnique({
      where: { key: key.trim() },
      select: {
        id: true,
        name: true,
        role: true,
        monthlySalary: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kunci akses tidak valid atau akun tidak aktif');
    }

    if (expectedRole && user.role !== expectedRole) {
      const expectedLabel = expectedRole === Role.ADMIN ? 'Administrator' : 'Karyawan';
      const actualLabel = user.role === Role.ADMIN ? 'Administrator' : 'Karyawan';
      throw new UnauthorizedException(
        `Kunci akses tidak valid atau akun tidak aktif'.`,
      );
    }

    this.logger.log(`User "${user.name}" (${user.role}) authenticated successfully`);

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      monthlySalary: user.monthlySalary ?? 0,
    };
  }

  /**
   * Generates minimal JWT payload { sub: user.id } and sets secure HttpOnly cookie
   */
  async login(user: SafeUserProfile, response: Response): Promise<SafeUserProfile> {
    const payload = { sub: user.id };
    const token = this.jwtService.sign(payload);

    const cookieOptions = this.getCookieOptions();

    // Set JWT strictly in HttpOnly Cookie - inaccessible to JavaScript
    response.cookie('access_token', token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (1 month) in milliseconds
    });

    return {
      ...user,
      token,
    };
  }

  /**
   * Clears the HttpOnly access_token cookie
   */
  async logout(response: Response): Promise<{ success: boolean }> {
    const cookieOptions = this.getCookieOptions();
    response.clearCookie('access_token', cookieOptions);

    return { success: true };
  }

  /**
   * Helper to determine secure & CSRF-resilient cookie options based on environment
   */
  private getCookieOptions() {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const sameSiteConfig =
      this.configService.get<string>('COOKIE_SAME_SITE') as
        | 'lax'
        | 'strict'
        | 'none'
        | undefined;
    const sameSite: 'lax' | 'strict' | 'none' = sameSiteConfig || 'lax';

    const secureConfig = this.configService.get<boolean>('COOKIE_SECURE');
    const secure =
      secureConfig !== undefined
        ? secureConfig
        : sameSite === 'none'
          ? true
          : isProduction;

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
    };
  }
}
