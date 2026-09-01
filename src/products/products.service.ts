import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: PaginationQueryDto) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 50;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const sortOrder = query?.sortOrder || 'asc';
    const sortBy = query?.sortBy || 'createdAt';

    const where: Prisma.ProductWhereInput = {
      deletedAt: null, // Exclude soft deleted items
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
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return {
      products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        price: Math.round(dto.price),
        stock: dto.stock !== undefined ? Math.round(dto.stock) : 0,
        rawMaterialCost:
          dto.rawMaterialCost !== undefined ? Math.round(dto.rawMaterialCost) : 0,
        imageUrl: dto.imageUrl || '/matcha-latte.jpg',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
      }
      throw error;
    }
  }

  async remove(id: string, softDelete = true) {
    try {
      if (softDelete) {
        return await this.prisma.product.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false },
        });
      }
      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
      }
      throw error;
    }
  }
}
