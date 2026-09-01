import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsNotEmpty({ message: 'Nama menu tidak boleh kosong' })
  @IsString({ message: 'Nama menu harus berupa teks' })
  name: string;

  @IsNotEmpty({ message: 'Harga menu tidak boleh kosong' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Harga harus berupa angka' })
  @Min(0, { message: 'Harga tidak boleh negatif' })
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Stok harus berupa angka' })
  @Min(0, { message: 'Stok tidak boleh negatif' })
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Harga bahan baku (HPP) harus berupa angka' })
  @Min(0, { message: 'HPP tidak boleh negatif' })
  rawMaterialCost?: number;

  @IsNotEmpty({ message: 'Gambar produk wajib diupload ke Supabase Object Storage' })
  @IsString({ message: 'URL gambar harus berupa string yang valid' })
  imageUrl: string;

  @IsOptional()
  @IsBoolean({ message: 'Status aktif harus berupa boolean' })
  isActive?: boolean;
}
