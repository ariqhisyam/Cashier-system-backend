import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentMethod } from '../common/enums';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockTx: any = {
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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

    it('should fallback to productName if productId (like dummy ID "1") is not found by ID', async () => {
      // First lookup by ID '1' returns null
      mockTx.product.findUnique.mockResolvedValue(null);
      // Fallback lookup by name finds the real product
      mockTx.product.findFirst.mockResolvedValue({
        id: 'real-uuid-pink-berry',
        name: 'Pink Berry',
        price: 17000,
        stock: 50,
        rawMaterialCost: 6419,
        isActive: true,
      });

      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-fallback-789',
        total: 17000,
        items: [],
      });

      const result = await service.create(
        {
          items: [{ productId: '1', productName: 'Pink Berry', quantity: 1 }],
          paymentMethod: PaymentMethod.CASH,
          cashPaid: 20000,
        },
        { id: 'user-1', name: 'kuylaa' },
      );

      expect(mockTx.product.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'Pink Berry', mode: 'insensitive' } },
      });
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'real-uuid-pink-berry' },
        data: { stock: { decrement: 1 } },
      });
      expect(result.id).toBe('tx-fallback-789');
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

  describe('deleteTransaction', () => {
    it('should delete transaction and restore product stock', async () => {
      mockTx.transaction.findUnique = jest.fn().mockResolvedValue({
        id: 'tx-123',
        items: [{ productId: 'prod-1', quantity: 2 }],
      });
      mockTx.product.update = jest.fn().mockResolvedValue({});
      mockTx.transaction.delete = jest.fn().mockResolvedValue({});

      const result = await service.deleteTransaction('tx-123');
      expect(result.id).toBe('tx-123');
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: { increment: 2 } },
      });
      expect(mockTx.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-123' },
      });
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockTx.transaction.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.deleteTransaction('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteShiftReport', () => {
    it('should delete shift report by id', async () => {
      mockPrisma.shiftReport = {
        findUnique: jest.fn().mockResolvedValue({ id: 'shift-1', shiftName: 'Shift 1' }),
        delete: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      };

      const result = await service.deleteShiftReport('shift-1');
      expect(result.id).toBe('shift-1');
      expect(mockPrisma.shiftReport.delete).toHaveBeenCalledWith({
        where: { id: 'shift-1' },
      });
    });

    it('should throw NotFoundException if shift report not found', async () => {
      mockPrisma.shiftReport = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(service.deleteShiftReport('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitShiftReport', () => {
    it('should set totalExpenses to 0 for shift and calculate net profit without store expenses', async () => {
      mockPrisma.user = {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', monthlySalary: 800000 }),
      };
      mockPrisma.shiftReport = {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'shift-new', ...args.data })),
      };

      const result = await service.submitShiftReport({
        shiftName: 'Shift 1',
        totalGrossRevenue: 300000,
        totalCups: 10,
        totalTransactions: 2,
        cashRevenue: 200000,
        qrisRevenue: 100000,
        cashCups: 6,
        qrisCups: 4,
        totalHpp: 100000,
        dailySalaryCost: 0, // Should auto-calculate 800000 / 30 = 26667
        totalExpenses: 0,
      }, { id: 'user-1', name: 'Ahmad Fauzi' });

      expect(mockPrisma.shiftReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dailySalaryCost: 26667,
            totalExpenses: 0,
            netProfit: 300000 - 100000 - 26667, // 173333
          }),
        }),
      );
      expect(result.totalExpenses).toBe(0);
      expect(result.netProfit).toBe(173333);
    });
  });
});
