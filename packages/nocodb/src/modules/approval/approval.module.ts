import { Module } from '@nestjs/common';
import {
  ApprovalFlowController,
} from './controllers';
import {
  ApprovalEngineService,
  ApprovalFlowService,
  ApprovalInstanceService,
} from './services';

/**
 * 审批流模块
 * 提供审批流程的管理和执行功能
 */
@Module({
  controllers: [ApprovalFlowController],
  providers: [
    ApprovalEngineService,
    ApprovalFlowService,
    ApprovalInstanceService,
  ],
  exports: [
    ApprovalEngineService,
    ApprovalFlowService,
    ApprovalInstanceService,
  ],
})
export class ApprovalModule {}
