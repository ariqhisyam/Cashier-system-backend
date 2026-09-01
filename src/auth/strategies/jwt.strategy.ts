import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Custom extractor to retrieve JWT strictly from HttpOnly cookie 'access_token'
 */
const cookieExtractor = (req: Request): string | null => {
  if (!req) return null;
  if (req.cookies && req.cookies['access_token']) {
    return req.cookies['access_token'];
  }
  if (req.headers && req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(';');
    for (const cookieStr of rawCookies) {
      const [name, ...rest] = cookieStr.trim().split('=');
      if (name === 'access_token') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
};

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'matcha-kyoto-pos-super-secret-jwt-key-2026',
    });
  }

  /**
   * Validate token payload, load user fresh from database to ensure current active status & role
   */
  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Token tidak valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Akun tidak ditemukan atau status akun nonaktif',
      );
    }

    return user;
  }
}
