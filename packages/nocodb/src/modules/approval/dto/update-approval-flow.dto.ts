import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { FlowStatus } from '../models/approval-flow.model';

/**
 * 更新审批流 DTO
 */
export class UpdateApprovalFlowDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FlowStatus)
  @IsOptional()
  status?: FlowStatus;

  @IsNumber()
  @Min(1)
  @IsOptional()
  version?: number;

  @IsString()
  @IsOptional()
  startNodeId?: string;
}
