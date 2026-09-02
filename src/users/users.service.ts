import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch paginated users with filtering & search
   */
  async findAll(query?: UserQueryDto) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 5;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const role = query?.role;
    const isActive = query?.isActive;
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query?.sortBy || 'createdAt';

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      }),
    ]);

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Find single user by ID
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Karyawan dengan ID ${id} tidak ditemukan`);
    }

    return user;
  }

  /**
   * Find user by access key
   */
  async findByKey(key: string) {
    return this.prisma.user.findUnique({
      where: { key },
    });
  }

  /**
   * Create new user
   */
  async create(dto: CreateUserDto) {
    // Check if key already exists
    const existingKey = await this.prisma.user.findUnique({
      where: { key: dto.key.trim() },
    });

    if (existingKey) {
      throw new ConflictException(
        `Kunci akses "${dto.key}" sudah digunakan oleh karyawan lain (${existingKey.name}). Gunakan kunci akses yang berbeda.`,
      );
    }

    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        key: dto.key.trim(),
        role: dto.role || Role.KARYAWAN,
        monthlySalary: dto.monthlySalary !== undefined ? Math.round(dto.monthlySalary) : 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  /**
   * Update existing user
   */
  async update(id: string, dto: UpdateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`Karyawan dengan ID ${id} tidak ditemukan`);
    }

    // If key is being changed, verify uniqueness
    if (dto.key && dto.key.trim() !== existingUser.key) {
      const conflict = await this.prisma.user.findUnique({
        where: { key: dto.key.trim() },
      });

      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `Kunci akses "${dto.key}" sudah digunakan oleh karyawan lain (${conflict.name}).`,
        );
      }
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.key !== undefined && { key: dto.key.trim() }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.monthlySalary !== undefined && {
        monthlySalary: Math.round(dto.monthlySalary),
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Hard delete user
   */
  async remove(id: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`Karyawan dengan ID ${id} tidak ditemukan`);
    }

    // Direct hard delete
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
