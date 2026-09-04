import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CloseShiftDto {
  @IsString()
  shiftName: string;

  @IsNumber()
  totalGrossRevenue: number;

  @IsNumber()
  totalCups: number;

  @IsNumber()
  totalTransactions: number;

  @IsNumber()
  cashRevenue: number;

  @IsNumber()
  qrisRevenue: number;

  @IsNumber()
  cashCups: number;

  @IsNumber()
  qrisCups: number;

  @IsNumber()
  totalHpp: number;

  @IsOptional()
  @IsNumber()
  dailySalaryCost?: number;

  @IsOptional()
  @IsNumber()
  totalExpenses?: number;

  @IsNumber()
  netProfit: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
