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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@Body() dto: CreateExpenseDto) {
    const data = await this.expensesService.create(dto);
    return {
      message: 'Pengeluaran berhasil disimpan',
      data,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Get()
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.expensesService.findAll(startDate, endDate);
    return {
      message: 'Daftar pengeluaran berhasil diambil',
      data,
    };
  }

  @Roles(Role.ADMIN, Role.KARYAWAN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.expensesService.remove(id);
    return result;
  }
}
