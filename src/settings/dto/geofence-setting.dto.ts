import { IsBoolean, IsNumber, IsString, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveGeofenceDto {
  @IsNumber({}, { message: 'Latitude harus berupa angka koordinat' })
  @Type(() => Number)
  latitude: number;

  @IsNumber({}, { message: 'Longitude harus berupa angka koordinat' })
  @Type(() => Number)
  longitude: number;

  @IsNumber({}, { message: 'Radius harus berupa angka' })
  @Type(() => Number)
  @Min(10, { message: 'Radius minimal 10 meter' })
  @Max(2000, { message: 'Radius maksimal 2000 meter' })
  radiusMeters: number;

  @IsBoolean({ message: 'Status keaktifan harus berupa boolean' })
  isEnabled: boolean;

  @IsString()
  @IsNotEmpty({ message: 'Nama alamat/outlet tidak boleh kosong' })
  addressName: string;
}
