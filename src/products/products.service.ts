import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Fetch paginated products with latest-first sorting
   */
  async findAll(query?: PaginationQueryDto) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 3;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query?.sortBy || 'createdAt';

    const where: Prisma.ProductWhereInput = {
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      }),
    ]);

    return {
      products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    if (!dto.imageUrl || !dto.imageUrl.startsWith('http')) {
      throw new BadRequestException(
        'Gambar produk wajib diupload ke Supabase Object Storage (URL publik S3).',
      );
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        price: Math.round(dto.price),
        stock: dto.stock !== undefined ? Math.round(dto.stock) : 0,
        rawMaterialCost:
          dto.rawMaterialCost !== undefined ? Math.round(dto.rawMaterialCost) : 0,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  /**
   * Update product and delete old image from storage if replaced
   */
  async update(id: string, dto: UpdateProductDto) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }

    // If image URL changed, delete old image from Supabase Storage
    if (
      dto.imageUrl !== undefined &&
      dto.imageUrl !== existingProduct.imageUrl &&
      existingProduct.imageUrl
    ) {
      this.logger.log(
        `Product image replaced for "${existingProduct.name}". Deleting old image: ${existingProduct.imageUrl}`,
      );
      await this.storageService.deleteFileByUrl(existingProduct.imageUrl);
    }

    const data: Prisma.ProductUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.price !== undefined && { price: Math.round(dto.price) }),
      ...(dto.stock !== undefined && { stock: Math.round(dto.stock) }),
      ...(dto.rawMaterialCost !== undefined && {
        rawMaterialCost: Math.round(dto.rawMaterialCost),
      }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    return await this.prisma.product.update({
      where: { id },
      data,
    });
  }

  /**
   * Hard delete product and remove its image from Supabase Object Storage
   */
  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }

    // 1. Delete image file from Supabase Object Storage
    if (product.imageUrl) {
      this.logger.log(
        `Deleting image from Supabase Storage for deleted product "${product.name}": ${product.imageUrl}`,
      );
      await this.storageService.deleteFileByUrl(product.imageUrl);
    }

    // 2. Hard delete product from database
    return await this.prisma.product.delete({
      where: { id },
    });
  }
}
