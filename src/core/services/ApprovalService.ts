import { approvalRepository, notificationRepository } from '../repositories';
import type {
  ApprovalRequest,
  ApprovalStep,
  User,
} from '../../types/models';
import { SYSTEM_ROLES } from './RbacService';

export class ApprovalService {
  /**
   * Evaluates sequential approval steps required for a document based on amount thresholds.
   */
  static determineSteps(
    documentType: 'PR' | 'PO' | 'CONTRACT' | 'DISPOSAL',
    amount: number
  ): ApprovalStep[] {
    if (documentType === 'DISPOSAL') {
      return [
        {
          stepNumber: 1,
          roleCode: SYSTEM_ROLES.ASSET_MANAGER,
          roleName: 'مدير الأصول والمعدات',
          status: 'pending',
        },
        {
          stepNumber: 2,
          roleCode: SYSTEM_ROLES.FINANCE_MANAGER,
          roleName: 'المدير المالي',
          status: 'pending',
        },
      ];
    }

    // SAP Purchase Order / Requisition Release Strategy
    if (amount <= 50000) {
      return [
        {
          stepNumber: 1,
          roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER,
          roleName: 'مدير المشتريات',
          status: 'pending',
        },
      ];
    } else if (amount <= 250000) {
      return [
        {
          stepNumber: 1,
          roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER,
          roleName: 'مدير المشتريات',
          status: 'pending',
        },
        {
          stepNumber: 2,
          roleCode: SYSTEM_ROLES.FINANCE_MANAGER,
          roleName: 'المدير المالي',
          status: 'pending',
        },
      ];
    } else {
      return [
        {
          stepNumber: 1,
          roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER,
          roleName: 'مدير المشتريات',
          status: 'pending',
        },
        {
          stepNumber: 2,
          roleCode: SYSTEM_ROLES.FINANCE_MANAGER,
          roleName: 'المدير المالي',
          status: 'pending',
        },
        {
          stepNumber: 3,
          roleCode: SYSTEM_ROLES.ADMIN,
          roleName: 'المدير العام (مدير النظام)',
          status: 'pending',
        },
      ];
    }
  }

  /**
   * Submits a document for approval.
   */
  static async submitForApproval(options: {
    documentType: 'PR' | 'PO' | 'CONTRACT' | 'DISPOSAL';
    documentId: string;
    documentNumber: string;
    amount: number;
    currency?: string;
    requester: User;
  }): Promise<ApprovalRequest> {
    const steps = this.determineSteps(options.documentType, options.amount);
    const id = `APR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const request: ApprovalRequest = {
      id,
      documentType: options.documentType,
      documentId: options.documentId,
      documentNumber: options.documentNumber,
      amount: options.amount,
      currency: options.currency || 'SAR',
      requesterUserId: options.requester.id,
      requesterUserName: options.requester.fullName,
      currentStep: 1,
      status: 'pending',
      steps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };

    await approvalRepository.create(request, {
      userId: options.requester.id,
      userName: options.requester.fullName,
    });

    // Notify first approver role
    await notificationRepository.create(
      {
        id: `notif-${Date.now()}`,
        userId: steps[0].roleCode, // Broadcast to role
        title: `طلب اعتماد جديد: ${options.documentNumber}`,
        message: `يتطلب المستند ${options.documentNumber} بقيمة ${options.amount} ${options.currency || 'SAR'} موافقتك.`,
        type: 'approval',
        isRead: false,
        createdAt: new Date().toISOString(),
        isDeleted: false,
      },
      { userId: options.requester.id, userName: options.requester.fullName }
    );

    return request;
  }

  /**
   * Approves or rejects the current step of an approval request.
   */
  static async processStep(options: {
    requestId: string;
    action: 'approve' | 'reject';
    comment?: string;
    approver: User;
  }): Promise<ApprovalRequest> {
    const request = await approvalRepository.getById(options.requestId);
    if (!request) {
      throw new Error(`Approval request with ID ${options.requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(`طلب الاعتماد هذا قد تمت معالجته مسبقاً بحالة (${request.status}).`);
    }

    const currentStepIndex = request.currentStep - 1;
    const currentStep = request.steps[currentStepIndex];

    if (!currentStep) {
      throw new Error('خطأ في مؤشر تسلسل خطوات الاعتماد.');
    }

    // Role verification
    if (
      options.approver.roleCode !== currentStep.roleCode &&
      options.approver.roleCode !== SYSTEM_ROLES.ADMIN
    ) {
      throw new Error(
        `أنت غير مخول باعتماد هذه المرحلة. الصلاحية مخصصة لدور [${currentStep.roleName}].`
      );
    }

    const updatedSteps = [...request.steps];
    const now = new Date().toISOString();

    if (options.action === 'reject') {
      updatedSteps[currentStepIndex] = {
        ...currentStep,
        status: 'rejected',
        approverUserId: options.approver.id,
        approverUserName: options.approver.fullName,
        actionDate: now,
        comment: options.comment || 'تم الرفض بدون إبداء ملاحظات',
      };

      const updated = await approvalRepository.update(
        request.id,
        {
          status: 'rejected',
          steps: updatedSteps,
        },
        { userId: options.approver.id, userName: options.approver.fullName }
      );

      // Notify requester of rejection
      await notificationRepository.create({
        id: `notif-${Date.now()}`,
        userId: request.requesterUserId,
        title: `تم رفض المستند: ${request.documentNumber}`,
        message: `قام ${options.approver.fullName} برفض الطلب. السبب: ${options.comment || 'لا يوجد'}`,
        type: 'approval',
        isRead: false,
        createdAt: now,
        isDeleted: false,
      });

      return updated;
    }

    // Action: Approve
    updatedSteps[currentStepIndex] = {
      ...currentStep,
      status: 'approved',
      approverUserId: options.approver.id,
      approverUserName: options.approver.fullName,
      actionDate: now,
      comment: options.comment || 'تمت الموافقة والاعتماد',
    };

    const isFinalStep = request.currentStep >= request.steps.length;

    if (isFinalStep) {
      const updated = await approvalRepository.update(
        request.id,
        {
          status: 'approved',
          steps: updatedSteps,
        },
        { userId: options.approver.id, userName: options.approver.fullName }
      );

      // Notify requester of full approval
      await notificationRepository.create({
        id: `notif-${Date.now()}`,
        userId: request.requesterUserId,
        title: `تم اعتماد المستند نهائياً: ${request.documentNumber}`,
        message: `تم استكمال كافة مراحل الاعتماد للمستند بنجاح.`,
        type: 'approval',
        isRead: false,
        createdAt: now,
        isDeleted: false,
      });

      return updated;
    } else {
      // Advance to next step
      const nextStepNum = request.currentStep + 1;
      const nextStep = updatedSteps[nextStepNum - 1];

      const updated = await approvalRepository.update(
        request.id,
        {
          currentStep: nextStepNum,
          steps: updatedSteps,
        },
        { userId: options.approver.id, userName: options.approver.fullName }
      );

      // Notify next approver role
      await notificationRepository.create({
        id: `notif-${Date.now()}`,
        userId: nextStep.roleCode,
        title: `طلب اعتماد محال إليك: ${request.documentNumber}`,
        message: `تم اعتماد المرحلة السابقة من قبل ${options.approver.fullName}. المستند بانتظار موافقتك.`,
        type: 'approval',
        isRead: false,
        createdAt: now,
        isDeleted: false,
      });

      return updated;
    }
  }
}
