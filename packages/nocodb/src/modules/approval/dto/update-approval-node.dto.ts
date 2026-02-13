import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import {
  NodeType,
  ApproverType,
  CounterSignType,
} from '../models/approval-node.model';

/**
 * 更新审批节点 DTO
 */
export class UpdateApprovalNodeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(NodeType)
  @IsOptional()
  nodeType?: NodeType;

  @IsEnum(ApproverType)
  @IsOptional()
  approverType?: ApproverType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  approverIds?: string[];

  @IsString()
  @IsOptional()
  approverRole?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsEnum(CounterSignType)
  @IsOptional()
  counterSignType?: CounterSignType;

  @IsNumber()
  @Min(1)
  @IsOptional()
  minApprovals?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxRejections?: number;

  @IsString()
  @IsOptional()
  nextNodeId?: string;

  @IsString()
  @IsOptional()
  trueNodeId?: string;

  @IsString()
  @IsOptional()
  falseNodeId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsNumber()
  @IsOptional()
  timeoutHours?: number;

  @IsEnum(['auto_approve', 'auto_reject', 'notify'])
  @IsOptional()
  timeoutAction?: 'auto_approve' | 'auto_reject' | 'notify';
}
