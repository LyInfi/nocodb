import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';

/**
 * 审批操作 DTO
 */
export class ApprovalActionDto {
  @IsEnum(['approve', 'reject', 'transfer', 'delegate'])
  action: 'approve' | 'reject' | 'transfer' | 'delegate';

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsString()
  @IsOptional()
  newAssigneeId?: string; // 转办或委派时使用
}
