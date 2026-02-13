import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { InstanceStatus } from '../models/approval-instance.model';
import { ProjectType } from '../models/approval-flow.model';

/**
 * 审批实例查询 DTO
 */
export class ApprovalInstanceQueryDto {
  @IsString()
  @IsOptional()
  flowId?: string;

  @IsEnum(InstanceStatus)
  @IsOptional()
  status?: InstanceStatus;

  @IsString()
  @IsOptional()
  initiatedBy?: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

import { Max } from 'class-validator';

/**
 * 审批任务查询 DTO
 */
export class ApprovalTaskQueryDto {
  @IsString()
  @IsOptional()
  instanceId?: string;

  @IsString()
  @IsOptional()
  nodeId?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

/**
 * 审批流查询 DTO
 */
export class ApprovalFlowQueryDto {
  @IsEnum(ProjectType)
  @IsOptional()
  projectType?: ProjectType;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
