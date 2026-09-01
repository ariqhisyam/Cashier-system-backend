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

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp|gif|svg)$/i,
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
