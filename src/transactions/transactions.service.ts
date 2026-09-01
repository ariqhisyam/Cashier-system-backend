import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

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

    // Fire-and-forget Telegram notification (non-blocking for cashier UI)
    this.telegramService.sendTransactionNotification(result).catch((err) => {
      this.logger.error(
        `Failed to send Telegram notification for tx #${result.id}: ${err?.message}`,
      );
    });

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
}
