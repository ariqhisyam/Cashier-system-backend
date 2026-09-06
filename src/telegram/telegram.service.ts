import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramTransactionPayload {
  id: string;
  total: number;
  cashierName: string;
  paymentMethod: 'CASH' | 'QRIS' | string;
  cashPaid?: number | null;
  changeAmount?: number | null;
  qrisProofUrl?: string | null;
  createdAt: Date | string;
  items: Array<{
    productName: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
}

export interface TelegramShiftReportPayload {
  shiftName: string;
  closedBy: string;
  totalGrossRevenue: number;
  totalCups: number;
  totalTransactions: number;
  cashRevenue: number;
  qrisRevenue: number;
  cashCups: number;
  qrisCups: number;
  totalHpp: number;
  dailySalaryCost?: number;
  totalExpenses?: number;
  netProfit: number;
  notes?: string | null;
  closedAt: Date | string | number;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | undefined;
  private readonly chatIds: string[] = [];

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const rawChatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '-5465977680';
    if (rawChatId) {
      this.chatIds = rawChatId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }

    if (this.botToken && this.chatIds.length > 0) {
      this.logger.log(
        `Telegram Bot service initialized with ${this.chatIds.length} target chat(s): ${this.chatIds.join(', ')}`,
      );
    } else {
      this.logger.warn('Telegram Bot credentials missing in configuration');
    }
  }

  private formatRupiah(amount: number): string {
    const val = Number(amount || 0);
    if (val < 0) {
      return '-Rp ' + Math.abs(val).toLocaleString('id-ID');
    }
    return 'Rp ' + val.toLocaleString('id-ID');
  }

  /**
   * Send real-time cashier transaction receipt notification to Telegram
   */
  async sendTransactionNotification(tx: TelegramTransactionPayload): Promise<boolean> {
    if (!this.botToken || this.chatIds.length === 0) {
      return false;
    }

    const shortId = tx.id ? tx.id.slice(0, 8).toUpperCase() : 'N/A';
    const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
    const dateFormatted = txDate.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isQris = tx.paymentMethod === 'QRIS';
    const methodBadge = isQris ? '📱 QRIS' : '💵 CASH';

    const itemsText = (tx.items || [])
      .map(
        (item) =>
          `• <b>${item.quantity}x</b> ${item.productName} — <code>${this.formatRupiah(
            item.subtotal,
          )}</code>`,
      )
      .join('\n');

    let paymentDetails = '';
    if (isQris) {
      paymentDetails = `💰 <b>Total Tagihan:</b> ${this.formatRupiah(tx.total)}\n💳 <b>Status:</b> Lunas via QRIS`;
    } else {
      paymentDetails = `💰 <b>Total Tagihan:</b> ${this.formatRupiah(
        tx.total,
      )}\n💵 <b>Uang Diterima:</b> ${this.formatRupiah(
        tx.cashPaid || 0,
      )}\n🪙 <b>Kembalian:</b> ${this.formatRupiah(tx.changeAmount || 0)}`;
    }

    const messageHtml = [
      `🧾 <b>STRUK PEMBAYARAN KASIR</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🆔 <b>No. Struk:</b> #<code>${shortId}</code>`,
      `👤 <b>Kasir:</b> ${tx.cashierName || 'Kasir'}`,
      `📅 <b>Waktu:</b> ${dateFormatted} WIB`,
      `💳 <b>Metode:</b> ${methodBadge}`,
      ``,
      `📦 <b>Rincian Pesanan:</b>`,
      itemsText,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      paymentDetails,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ <i>Transaksi Sukses & Stok Terpotong</i>`,
    ].join('\n');

    try {
      const sendPromises = this.chatIds.map(async (chatId) => {
        // If QRIS proof image exists, try sending as photo first
        if (isQris && tx.qrisProofUrl) {
          try {
            const photoRes = await fetch(
              `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  photo: tx.qrisProofUrl,
                  caption: messageHtml,
                  parse_mode: 'HTML',
                }),
              },
            );

            const photoData = await photoRes.json();
            if (photoData.ok) {
              return true;
            }
          } catch {
            // fallback to text message
          }
        }

        // Default text message
        const textRes = await fetch(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageHtml,
              parse_mode: 'HTML',
            }),
          },
        );

        const textData = await textRes.json();
        return !!textData.ok;
      });

      const results = await Promise.all(sendPromises);
      const anySuccess = results.some(Boolean);
      if (anySuccess) {
        this.logger.log(`Telegram receipt sent for transaction #${shortId} to ${results.filter(Boolean).length} chat(s)`);
      }
      return anySuccess;
    } catch (err: any) {
      this.logger.error(`Error sending Telegram notification: ${err?.message}`);
      return false;
    }
  }

  /**
   * Send shift closure report summary to Telegram
   */
  async sendShiftCloseNotification(report: TelegramShiftReportPayload): Promise<boolean> {
    if (!this.botToken || this.chatIds.length === 0) {
      return false;
    }

    const closeDate = report.closedAt ? new Date(report.closedAt) : new Date();
    const dateFormatted = closeDate.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const messageHtml = [
      `📊 <b>LAPORAN TUTUP SHIFT KASIR</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Kasir:</b> ${report.closedBy || 'Kasir'}`,
      `📅 <b>Waktu Tutup:</b> ${dateFormatted} WIB`,
      `📋 <b>Shift:</b> ${report.shiftName}`,
      ``,
      `🥤 <b>Total Cup Terjual:</b> <b>${report.totalCups} Cup</b>`,
      `  • 💵 Cash : ${report.cashCups} Cup (${this.formatRupiah(report.cashRevenue)})`,
      `  • 📱 QRIS : ${report.qrisCups} Cup (${this.formatRupiah(report.qrisRevenue)})`,
      `🧾 <b>Total Transaksi:</b> ${report.totalTransactions} Struk`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 <b>Omset Kotor:</b> ${this.formatRupiah(report.totalGrossRevenue)}`,
      `📦 <b>Estimasi HPP:</b> -${this.formatRupiah(report.totalHpp)}`,
      ...(report.dailySalaryCost && report.dailySalaryCost > 0 ? [`💼 <b>Beban Gaji Kasir:</b> -${this.formatRupiah(report.dailySalaryCost)}`] : []),
      ...(report.totalExpenses && report.totalExpenses > 0 ? [`🧾 <b>Biaya Operasional:</b> -${this.formatRupiah(report.totalExpenses)}`] : []),
      `📈 <b>Estimasi Laba Bersih:</b> <b>${this.formatRupiah(report.netProfit)}</b>`,
      ``,
      ...(report.notes ? [`📝 <b>Catatan:</b> <i>"${report.notes}"</i>`] : []),
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔒 <i>Shift resmi ditutup & tersimpan</i>`,
    ].join('\n');

    try {
      const sendPromises = this.chatIds.map(async (chatId) => {
        const res = await fetch(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageHtml,
              parse_mode: 'HTML',
            }),
          },
        );

        const data = await res.json();
        return !!data.ok;
      });

      const results = await Promise.all(sendPromises);
      return results.some(Boolean);
    } catch (err: any) {
      this.logger.error(`Error sending Telegram shift report: ${err?.message}`);
      return false;
    }
  }
}
