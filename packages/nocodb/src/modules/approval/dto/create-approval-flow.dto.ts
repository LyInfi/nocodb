import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ProjectType, FlowStatus } from '../models/approval-flow.model';

/**
 * 创建审批流 DTO
 */
export class CreateApprovalFlowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProjectType)
  projectType: ProjectType;

  @IsNumber()
  @Min(1)
  @IsOptional()
  version?: number = 1;

  @IsEnum(FlowStatus)
  @IsOptional()
  status?: FlowStatus = FlowStatus.DRAFT;
}
