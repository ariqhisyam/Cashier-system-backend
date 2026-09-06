import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return 'fake-token';
      if (key === 'TELEGRAM_CHAT_ID') return 'fake-chat-id';
      return null;
    }),
  };

  beforeEach(() => {
    service = new TelegramService(mockConfigService);
    jest.clearAllMocks();
  });

  it('should format and send cash transaction notification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ ok: true, result: {} }),
    } as any);

    const tx = {
      id: 'tx-12345678',
      total: 30000,
      cashierName: 'kuylaa',
      paymentMethod: 'CASH',
      cashPaid: 50000,
      changeAmount: 20000,
      createdAt: new Date(),
      items: [
        { productName: 'Matcha Latte', price: 15000, quantity: 2, subtotal: 30000 },
      ],
    };

    const result = await service.sendTransactionNotification(tx);
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should send photo notification when QRIS proof URL is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ ok: true, result: {} }),
    } as any);

    const tx = {
      id: 'tx-87654321',
      total: 20000,
      cashierName: 'kuylaa',
      paymentMethod: 'QRIS',
      qrisProofUrl: 'https://example.com/proof.webp',
      createdAt: new Date(),
      items: [
        { productName: 'Matcha sip', price: 10000, quantity: 2, subtotal: 20000 },
      ],
    };

    const result = await service.sendTransactionNotification(tx);
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendPhoto'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should send photo notification via FormData when QRIS proof is a base64 Data URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ ok: true, result: {} }),
    } as any);

    const tx = {
      id: 'tx-99999999',
      total: 17000,
      cashierName: 'Ahmad Fauzi',
      paymentMethod: 'QRIS',
      qrisProofUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      createdAt: new Date(),
      items: [
        { productName: 'Pink Berry', price: 17000, quantity: 1, subtotal: 17000 },
      ],
    };

    const result = await service.sendTransactionNotification(tx);
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendPhoto'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
  });
});
