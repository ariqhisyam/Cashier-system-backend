import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama karyawan wajib diisi' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Kunci akses login wajib diisi' })
  @MinLength(3, { message: 'Kunci akses minimal 3 karakter' })
  @MaxLength(30, { message: 'Kunci akses maksimal 30 karakter' })
  key: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role harus ADMIN atau KARYAWAN' })
  role?: Role = Role.KARYAWAN;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Gaji bulanan harus berupa angka bulat' })
  @Min(0, { message: 'Gaji bulanan minimal 0' })
  monthlySalary?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
