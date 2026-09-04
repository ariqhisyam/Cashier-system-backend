import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto) {
    const expenseDate = dto.date ? new Date(dto.date) : new Date();

    const expense = await this.prisma.expense.create({
      data: {
        description: dto.description.trim(),
        amount: Math.round(dto.amount),
        date: expenseDate,
      },
    });

    this.logger.log(`Created expense: ${expense.description} - Rp ${expense.amount}`);
    return expense;
  }

  async findAll(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Pengeluaran dengan ID #${id} tidak ditemukan`);
    }

    await this.prisma.expense.delete({
      where: { id },
    });

    this.logger.log(`Deleted expense #${id}`);
    return { success: true, message: 'Pengeluaran berhasil dihapus' };
  }
}
