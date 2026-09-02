import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp|gif|svg|avif)$/i,
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10 MB limit for images
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    const result = await this.storageService.uploadFile(
      file,
      folder || 'products',
    );
    return {
      message: 'File berhasil diupload ke Supabase Storage',
      data: result,
    };
  }
}
