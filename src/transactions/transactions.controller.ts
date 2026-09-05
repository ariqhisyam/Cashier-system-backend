import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums';
import type { SafeUserProfile } from '../auth/auth.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @HttpCode(HttpStatus.CREATED)
  @Post('close-shift')
  async closeShift(
    @Body() dto: CloseShiftDto,
    @CurrentUser() user?: SafeUserProfile,
  ) {
    const result = await this.transactionsService.submitShiftReport(dto, {
      id: user?.id,
      name: user?.name,
    });

    return {
      message: 'Laporan shift berhasil disimpan dan dikirim ke Telegram',
      data: result,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user?: SafeUserProfile,
  ) {
    const result = await this.transactionsService.create(dto, {
      id: user?.id,
      name: user?.name,
    });

    return {
      message: 'Transaksi berhasil disimpan dan stok produk telah diperbarui',
      data: result,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Get('shift-reports')
  async getShiftReports() {
    const result = await this.transactionsService.getShiftReports();
    return {
      message: 'Daftar laporan shift berhasil diambil',
      data: result,
    };
  }

  @Roles(Role.ADMIN)
  @Delete('shift-reports/:id')
  async deleteShiftReport(@Param('id') id: string) {
    const result = await this.transactionsService.deleteShiftReport(id);
    return {
      message: result.message,
      data: result,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Get()
  async findAll(@Query() query: TransactionQueryDto) {
    const result = await this.transactionsService.findAll(query);
    return {
      message: 'Daftar transaksi berhasil diambil',
      data: result.transactions,
      meta: result.meta,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const transaction = await this.transactionsService.findOne(id);
    return {
      message: 'Detail transaksi berhasil diambil',
      data: transaction,
    };
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteTransaction(@Param('id') id: string) {
    const result = await this.transactionsService.deleteTransaction(id);
    return {
      message: result.message,
      data: result,
    };
  }
}
