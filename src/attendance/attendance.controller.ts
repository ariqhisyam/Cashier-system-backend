import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums';
import type { SafeUserProfile } from '../auth/auth.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @HttpCode(HttpStatus.OK)
  @Post('clock-in')
  async clockIn(
    @Body() dto: ClockInDto,
    @CurrentUser() user: SafeUserProfile,
  ) {
    const result = await this.attendanceService.clockIn(dto, user);
    return {
      message: 'Presensi masuk berhasil dicatat',
      data: result,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @HttpCode(HttpStatus.OK)
  @Post('clock-out')
  async clockOut(
    @Body() dto: ClockOutDto,
    @CurrentUser() user: SafeUserProfile,
  ) {
    const result = await this.attendanceService.clockOut(dto, user);
    return {
      message: 'Presensi keluar berhasil dicatat',
      data: result,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Get('active')
  async getActive(@CurrentUser() user: SafeUserProfile) {
    const active = await this.attendanceService.getActive(user);
    return {
      message: 'Status presensi aktif berhasil diambil',
      data: active,
    };
  }

  @Roles(Role.ADMIN)
  @Get()
  async findAll(@Query() query: AttendanceQueryDto) {
    const result = await this.attendanceService.findAll(query);
    return {
      message: 'Daftar riwayat presensi berhasil diambil',
      data: result.attendances,
      meta: result.meta,
    };
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.attendanceService.remove(id);
    return {
      message: 'Catatan presensi berhasil dihapus',
      data: result,
    };
  }
}
