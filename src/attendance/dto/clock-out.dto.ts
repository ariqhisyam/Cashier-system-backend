import { IsOptional, IsString } from 'class-validator';

export class ClockOutDto {
  @IsOptional()
  @IsString()
  attendanceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
