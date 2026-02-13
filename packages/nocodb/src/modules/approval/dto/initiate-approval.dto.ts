import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

/**
 * 发起审批 DTO
 */
export class InitiateApprovalDto {
  @IsString()
  @IsNotEmpty()
  businessType: string;

  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsOptional()
  flowId?: string;

  @IsObject()
  @IsOptional()
  contextData?: Record<string, any>;
}
