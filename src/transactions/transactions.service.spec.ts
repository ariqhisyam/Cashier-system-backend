import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentMethod } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockTx: any = {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
  };

  const mockPrisma: any = {
    $transaction: jest.fn(async (cb) => cb(mockTx)),
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockTelegramService: any = {
    sendTransactionNotification: jest.fn().mockResolvedValue(true),
    sendShiftCloseNotification: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    service = new TransactionsService(mockPrisma, mockTelegramService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a CASH transaction and decrement stock', async () => {
      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Matcha Ice Cream',
        price: 15000,
        stock: 20,
        rawMaterialCost: 6000,
        isActive: true,
      });

      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-123',
        total: 30000,
        cashierId: 'user-1',
        cashierName: 'kuylaa',
        paymentMethod: PaymentMethod.CASH,
        cashPaid: 50000,
        changeAmount: 20000,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Matcha Ice Cream',
            price: 15000,
            quantity: 2,
            subtotal: 30000,
            rawMaterialCost: 6000,
          },
        ],
      });

      const result = await service.create(
        {
          items: [{ productId: 'prod-1', quantity: 2 }],
          paymentMethod: PaymentMethod.CASH,
          cashPaid: 50000,
        },
        { id: 'user-1', name: 'kuylaa' },
      );

      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: { decrement: 2 } },
      });

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total: 30000,
            cashPaid: 50000,
            changeAmount: 20000,
            paymentMethod: PaymentMethod.CASH,
          }),
        }),
      );

      expect(result.id).toBe('tx-123');
      expect(result.total).toBe(30000);
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Matcha Ice Cream',
        price: 15000,
        stock: 1, // only 1 in stock
        rawMaterialCost: 6000,
        isActive: true,
      });

      await expect(
        service.create(
          {
            items: [{ productId: 'prod-1', quantity: 5 }],
            paymentMethod: PaymentMethod.CASH,
            cashPaid: 100000,
          },
          { id: 'user-1', name: 'kuylaa' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cashPaid is less than total', async () => {
      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Matcha Ice Cream',
        price: 15000,
        stock: 20,
        rawMaterialCost: 6000,
        isActive: true,
      });

      await expect(
        service.create(
          {
            items: [{ productId: 'prod-1', quantity: 2 }], // total: 30000
            paymentMethod: PaymentMethod.CASH,
            cashPaid: 20000, // less than 30000
          },
          { id: 'user-1', name: 'kuylaa' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a QRIS transaction with proof url', async () => {
      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Matcha Ice Cream',
        price: 15000,
        stock: 20,
        rawMaterialCost: 6000,
        isActive: true,
      });

      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-456',
        total: 15000,
        paymentMethod: PaymentMethod.QRIS,
        qrisProofUrl: 'https://example.com/proof.webp',
        items: [],
      });

      const result = await service.create(
        {
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: PaymentMethod.QRIS,
          qrisProofUrl: 'https://example.com/proof.webp',
        },
        { id: 'user-1', name: 'kuylaa' },
      );

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: PaymentMethod.QRIS,
            qrisProofUrl: 'https://example.com/proof.webp',
            cashPaid: undefined,
            changeAmount: 0,
          }),
        }),
      );
      expect(result.id).toBe('tx-456');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if transaction is not found', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
