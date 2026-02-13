import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import {
  OperatorType,
  LogicOperator,
} from '../models/approval-condition.model';

/**
 * 创建条件规则 DTO
 */
export class CreateConditionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(OperatorType)
  operator: OperatorType;

  @IsOptional()
  value?: any;

  @IsEnum(['string', 'number', 'boolean', 'date', 'array'])
  @IsOptional()
  valueType?: 'string' | 'number' | 'boolean' | 'date' | 'array';

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsEnum(LogicOperator)
  @IsOptional()
  logicOperator?: LogicOperator = LogicOperator.AND;

  @IsNumber()
  @Min(0)
  order: number;
}

import { IsNotEmpty } from 'class-validator';

/**
 * 更新条件规则 DTO
 */
export class UpdateConditionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  field?: string;

  @IsEnum(OperatorType)
  @IsOptional()
  operator?: OperatorType;

  @IsOptional()
  value?: any;

  @IsEnum(['string', 'number', 'boolean', 'date', 'array'])
  @IsOptional()
  valueType?: 'string' | 'number' | 'boolean' | 'date' | 'array';

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsEnum(LogicOperator)
  @IsOptional()
  logicOperator?: LogicOperator;

  @IsNumber()
  @Min(0)
  @IsOptional()
  order?: number;
}
