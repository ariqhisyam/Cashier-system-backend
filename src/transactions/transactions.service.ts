import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Creates a transaction and atomically decrements product stocks inside a database transaction
   */
  async create(dto: CreateTransactionDto, cashier: { id?: string; name?: string }) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Keranjang transaksi tidak boleh kosong.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const itemsData: Array<{
        productId: string;
        productName: string;
        price: number;
        quantity: number;
        subtotal: number;
        rawMaterialCost: number;
      }> = [];

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.isActive) {
          throw new BadRequestException(
            `Produk "${product?.name || item.productId}" tidak ditemukan atau sedang dinonaktifkan.`,
          );
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stok untuk "${product.name}" tidak mencukupi. Tersedia: ${product.stock}, diminta: ${item.quantity}.`,
          );
        }

        // Atomically decrement stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        const subtotal = product.price * item.quantity;
        total += subtotal;

        itemsData.push({
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: item.quantity,
          subtotal,
          rawMaterialCost: product.rawMaterialCost || 0,
        });
      }

      let cashPaid: number | undefined;
      let changeAmount: number | undefined;

      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.cashPaid === undefined || dto.cashPaid < total) {
          throw new BadRequestException(
            `Uang yang dibayarkan tidak mencukupi. Total tagihan: ${total}, diterima: ${dto.cashPaid || 0}.`,
          );
        }
        cashPaid = Math.round(dto.cashPaid);
        changeAmount = cashPaid - total;
      } else {
        cashPaid = undefined;
        changeAmount = 0;
      }

      const transaction = await tx.transaction.create({
        data: {
          total,
          cashierId: cashier.id || null,
          cashierName: cashier.name || 'Kasir Utama',
          paymentMethod: dto.paymentMethod,
          cashPaid,
          changeAmount,
          qrisProofUrl: dto.qrisProofUrl || null,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
        },
      });

      this.logger.log(
        `Transaction created: #${transaction.id} | Total: ${total} | Method: ${dto.paymentMethod} | Cashier: ${cashier.name || 'Kasir'}`,
      );

      return transaction;
    });

    // Dispatch Telegram notification (await so serverless execution context does not terminate prematurely)
    try {
      await this.telegramService.sendTransactionNotification(result);
    } catch (err: any) {
      this.logger.error(
        `Failed to send Telegram notification for tx #${result.id}: ${err?.message}`,
      );
    }

    return result;
  }

  /**
   * Fetch paginated transactions with date and payment filtering
   */
  async findAll(query?: TransactionQueryDto) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();
    const cashierId = query?.cashierId;
    const paymentMethod = query?.paymentMethod;
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = query?.sortBy || 'createdAt';

    const where: Prisma.TransactionWhereInput = {
      ...(cashierId && { cashierId }),
      ...(paymentMethod && { paymentMethod }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { cashierName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const [total, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
        include: {
          items: true,
        },
      }),
    ]);

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Find single transaction by ID including line items
   */
  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaksi dengan ID #${id} tidak ditemukan`);
    }

    return transaction;
  }

  /**
   * Submits a shift report, persists it to database, and dispatches notification to Telegram
   */
  async submitShiftReport(dto: CloseShiftDto, user?: { id?: string; name?: string }) {
    let dailySalaryCost = dto.dailySalaryCost ?? 0;
    const empId = user?.id || dto.employeeId;
    const empName = user?.name || dto.closedBy;

    // If dailySalaryCost was not provided or 0, look up the employee's monthly salary from database
    if (dailySalaryCost === 0 && (empId || empName)) {
      const emp = await this.prisma.user.findFirst({
        where: empId ? { id: empId } : { name: empName },
        select: { id: true, monthlySalary: true },
      });
      if (emp?.monthlySalary && emp.monthlySalary > 0) {
        dailySalaryCost = Math.round(emp.monthlySalary / 30);
      }
    }

    // Individual shift reports do not bear store operational expenses (expenses are deducted at the store daily/period summary level)
    const totalExpenses = 0;

    const netProfit =
      dto.totalGrossRevenue -
      dto.totalHpp -
      dailySalaryCost;

    const shiftReport = await this.prisma.shiftReport.create({
      data: {
        shiftName: dto.shiftName,
        closedBy: user?.name || dto.closedBy || 'Kasir',
        employeeId: user?.id || dto.employeeId || null,
        totalGrossRevenue: dto.totalGrossRevenue,
        totalCups: dto.totalCups,
        totalTransactions: dto.totalTransactions,
        cashRevenue: dto.cashRevenue,
        qrisRevenue: dto.qrisRevenue,
        cashCups: dto.cashCups,
        qrisCups: dto.qrisCups,
        totalHpp: dto.totalHpp,
        dailySalaryCost,
        totalExpenses,
        cashCount: dto.cashCount ?? 0,
        qrisCount: dto.qrisCount ?? 0,
        netProfit,
        notes: dto.notes || null,
        closedAt: new Date(),
      },
    });

    this.logger.log(
      `Shift closed by ${shiftReport.closedBy}: ${shiftReport.totalCups} cups sold, Gross: Rp ${shiftReport.totalGrossRevenue}`,
    );

    // Dispatch Telegram notification (await so serverless execution context does not terminate prematurely)
    try {
      await this.telegramService.sendShiftCloseNotification(shiftReport);
    } catch (err: any) {
      this.logger.error(
        `Failed to send Telegram shift report: ${err?.message}`,
      );
    }

    return shiftReport;
  }

  /**
   * Fetch all shift reports ordered by newest
   */
  async getShiftReports() {
    return this.prisma.shiftReport.findMany({
      orderBy: { closedAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Delete a specific transaction by ID and restore stock
   */
  async deleteTransaction(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaksi dengan ID #${id} tidak ditemukan`);
      }

      // Restore stock for each item if productId exists
      for (const item of transaction.items) {
        if (item.productId) {
          try {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: item.quantity },
              },
            });
          } catch {
            // ignore if product has been deleted
          }
        }
      }

      await tx.transaction.delete({
        where: { id },
      });

      this.logger.log(`Transaction #${id} deleted and stock restored`);
      return { id, message: 'Transaksi berhasil dihapus dan stok produk telah dikembalikan' };
    });
  }

  /**
   * Delete a specific shift report by ID
   */
  async deleteShiftReport(id: string) {
    const shift = await this.prisma.shiftReport.findUnique({
      where: { id },
    });

    if (!shift) {
      throw new NotFoundException(`Laporan shift dengan ID #${id} tidak ditemukan`);
    }

    await this.prisma.shiftReport.delete({
      where: { id },
    });

    this.logger.log(`Shift report #${id} (${shift.shiftName}) deleted`);
    return { id, message: 'Laporan shift berhasil dihapus' };
  }
}
