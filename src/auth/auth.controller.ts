import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { SafeUserProfile } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Key-based login endpoint with IP rate-limiting
   * In development: generous limit (10,000 req/min) to avoid blocking testing
   * In production: strict limit (5 req/min) to prevent brute-force
   */
  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 10000,
      ttl: 60000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.validateUserByKey(
      loginDto.key,
      loginDto.role,
    );
    const loggedInUser = await this.authService.login(user, response);

    return {
      message: 'Login berhasil',
      data: loggedInUser,
    };
  }

  /**
   * Returns current authenticated user profile by resolving JWT from HttpOnly Cookie
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: SafeUserProfile) {
    return {
      message: 'Profil pengguna berhasil diambil',
      data: user,
    };
  }

  /**
   * Logs out user by clearing the HttpOnly access_token cookie
   */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    await this.authService.logout(response);
    return {
      message: 'Logout berhasil',
      data: null,
    };
  }
}
