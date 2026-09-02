import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../common/enums';

export class LoginDto {
  @IsString({ message: 'Kunci akses harus berupa teks' })
  @IsNotEmpty({ message: 'Kunci akses wajib diisi' })
  @MinLength(3, { message: 'Kunci akses minimal 3 karakter' })
  @MaxLength(64, { message: 'Kunci akses maksimal 64 karakter' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  key: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Peran (role) harus ADMIN atau KARYAWAN' })
  role?: Role;
}
