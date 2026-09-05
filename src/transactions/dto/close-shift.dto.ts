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
  @IsOptional()
  @IsNumber()
  cashCount?: number;

  @IsOptional()
  @IsNumber()
  qrisCount?: number;
  @IsNumber()
  netProfit: number;

  @IsOptional()
  @IsString()
  closedBy?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

