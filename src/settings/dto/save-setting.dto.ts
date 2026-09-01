import { IsNotEmpty, IsString } from 'class-validator';

export class SaveQrisDto {
  @IsNotEmpty({ message: 'URL gambar QRIS tidak boleh kosong' })
  @IsString()
  imageUrl: string;
}

export class SetSettingDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsString()
  value: string;
}
