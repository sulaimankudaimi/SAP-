import { db } from '../../../core/db';
import { requirePermission } from '../../../core/security/SessionContext';
import { AuditService } from '../../../core/services/AuditService';
import { SYSTEM_ROLES } from '../../../core/services/RbacService';
import type {
  ApprovalRule,
  ApprovalRuleStep,
  WorkflowDocumentType,
  ApprovalStep,
} from '../../../types/models';

export class WorkflowService {
  /**
   * Default SAP standard approval rules seeded when database is empty.
   */
  private static getDefaultRules(): ApprovalRule[] {
    const now = new Date().toISOString();
    return [
      // 1. Purchase Orders (PO)
      {
        id: 'rule-po-1',
        documentType: 'PO',
        minAmount: 0,
        maxAmount: 50000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
        ],
        isActive: true,
        description: 'أوامر الشراء حتى 50,000 ريال (اعتماد مدير المشتريات)',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: 'rule-po-2',
        documentType: 'PO',
        minAmount: 50000.01,
        maxAmount: 250000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
        ],
        isActive: true,
        description: 'أوامر الشراء من 50,000 إلى 250,000 ريال (مدير المشتريات + المدير المالي)',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: 'rule-po-3',
        documentType: 'PO',
        minAmount: 250000.01,
        maxAmount: 999999999,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
          { stepNumber: 3, roleCode: SYSTEM_ROLES.ADMIN, roleName: 'المدير العام (مدير النظام)' },
        ],
        isActive: true,
        description: 'أوامر الشراء الكبرى أعلى من 250,000 ريال (مشتريات + مالي + مدير عام)',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },

      // 2. Purchase Requisitions (PR)
      {
        id: 'rule-pr-1',
        documentType: 'PR',
        minAmount: 0,
        maxAmount: 100000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
        ],
        isActive: true,
        description: 'طلبات الشراء حتى 100,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: 'rule-pr-2',
        documentType: 'PR',
        minAmount: 100000.01,
        maxAmount: 999999999,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
        ],
        isActive: true,
        description: 'طلبات الشراء أعلى من 100,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },

      // 3. Contracts
      {
        id: 'rule-cnt-1',
        documentType: 'CONTRACT',
        minAmount: 0,
        maxAmount: 500000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
        ],
        isActive: true,
        description: 'عقود التوريد العامة حتى 500,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: 'rule-cnt-2',
        documentType: 'CONTRACT',
        minAmount: 500000.01,
        maxAmount: 999999999,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
          { stepNumber: 3, roleCode: SYSTEM_ROLES.ADMIN, roleName: 'الرئيس التنفيذي / المدير العام' },
        ],
        isActive: true,
        description: 'عقود التوريد الاستراتيجية أعلى من 500,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },

      // 4. Asset Disposal
      {
        id: 'rule-disp-1',
        documentType: 'DISPOSAL',
        minAmount: 0,
        maxAmount: 999999999,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.ASSET_MANAGER, roleName: 'مدير الأصول والمعدات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
        ],
        isActive: true,
        description: 'استبعاد وتخريد الأصول الثابتة (مدير الأصول + المدير المالي)',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },

      // 5. Payments
      {
        id: 'rule-pay-1',
        documentType: 'PAYMENT',
        minAmount: 0,
        maxAmount: 200000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.ACCOUNTANT, roleName: 'محاسب المدفوعات' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
        ],
        isActive: true,
        description: 'أوامر وسندات الصرف حتى 200,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: 'rule-pay-2',
        documentType: 'PAYMENT',
        minAmount: 200000.01,
        maxAmount: 999999999,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
          { stepNumber: 2, roleCode: SYSTEM_ROLES.ADMIN, roleName: 'المدير العام' },
        ],
        isActive: true,
        description: 'أوامر وسندات الصرف الكبرى أعلى من 200,000 ريال',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ];
  }

  /**
   * Initializes default rules if table is empty.
   */
  static async initRulesIfEmpty(): Promise<void> {
    const count = await db.approvalRules.count();
    if (count === 0) {
      const defaults = this.getDefaultRules();
      await db.approvalRules.bulkAdd(defaults);
    }
  }

  /**
   * Validates a set of approval rules for gaps and overlaps.
   * Pure deterministic validator suitable for UI & tests.
   */
  static validateRules(rules: ApprovalRule[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!rules || rules.length === 0) {
      errors.push('يجب تحديد قاعدة اعتماد واحدة على الأقل لنوع المستند.');
      return { isValid: false, errors };
    }

    // Sort rules by minAmount ascending
    const sorted = [...rules].sort((a, b) => a.minAmount - b.minAmount);

    // 1. First rule must start at 0
    if (sorted[0].minAmount > 0) {
      errors.push(`القاعدة الأولى يجب أن تبدأ من الصفر (0 ريال)، ولكنها تبدأ من ${sorted[0].minAmount} ريال.`);
    }

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      // Validate bounds
      if (current.minAmount < 0) {
        errors.push(`الحد الأدنى في القاعدة ${i + 1} لا يمكن أن يكون سالباً.`);
      }
      if (current.maxAmount <= current.minAmount) {
        errors.push(`الحد الأقصى (${current.maxAmount}) يجب أن يكون أكبر من الحد الأدنى (${current.minAmount}) في القاعدة ${i + 1}.`);
      }
      if (!current.steps || current.steps.length === 0) {
        errors.push(`القاعدة ${i + 1} تفتقر إلى أي خطوات اعتماد ومسؤولين.`);
      }

      // Check overlap or gap with next rule
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];

        // Overlap: next.minAmount <= current.maxAmount (with small float tolerance)
        if (next.minAmount <= current.maxAmount && Math.abs(next.minAmount - current.maxAmount) > 0.01) {
          errors.push(
            `تداخل في النطاقات المالية (Overlap): القاعدة ${i + 1} تنتهي عند ${current.maxAmount} والقاعدة ${i + 2} تبدأ عند ${next.minAmount}.`
          );
        }

        // Gap: next.minAmount > current.maxAmount + 1
        if (next.minAmount > current.maxAmount + 1) {
          errors.push(
            `فجوة غير مغطاة (Gap): توجد فجوة مالية بين ${current.maxAmount} و ${next.minAmount} ريال غير مشمولة بأي تسلسل اعتماد.`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Retrieves approval rules, filtered by documentType if provided.
   */
  static async getRules(documentType?: WorkflowDocumentType): Promise<ApprovalRule[]> {
    await this.initRulesIfEmpty();
    let query = db.approvalRules.filter((r) => !r.isDeleted);
    if (documentType) {
      query = query.filter((r) => r.documentType === documentType);
    }
    const rules = await query.toArray();
    return rules.sort((a, b) => a.minAmount - b.minAmount);
  }

  /**
   * Saves and validates rules for a document type.
   */
  static async saveRules(
    documentType: WorkflowDocumentType,
    rules: ApprovalRule[]
  ): Promise<ApprovalRule[]> {
    requirePermission({ module: 'ADM', activity: 'create' });

    // Validate rules
    const validation = this.validateRules(rules);
    if (!validation.isValid) {
      throw new Error(`خطأ في تهيئة قواعد سير العمل: ${validation.errors.join(' | ')}`);
    }

    const now = new Date().toISOString();

    const preparedRules: ApprovalRule[] = rules.map((r, idx) => ({
      ...r,
      id: r.id || `rule-${documentType.toLowerCase()}-${idx + 1}-${Date.now()}`,
      documentType,
      updatedAt: now,
      createdAt: r.createdAt || now,
      isDeleted: false,
    }));

    await db.transaction('rw', [db.approvalRules, db.auditLogs], async () => {
      // Remove previous active rules for this doc type
      const oldRules = await db.approvalRules.where('documentType').equals(documentType).toArray();
      for (const old of oldRules) {
        await db.approvalRules.delete(old.id);
      }

      await db.approvalRules.bulkAdd(preparedRules);

      await AuditService.log({
        action: 'UPDATE',
        entity: 'WorkflowApprovalRules',
        entityId: documentType,
        after: {
          documentType,
          ruleCount: preparedRules.length,
          rulesSummary: preparedRules.map((r) => `${r.minAmount} -> ${r.maxAmount}`),
        },
      });
    });

    return preparedRules;
  }

  /**
   * Evaluates sequential approval steps for a specific document and amount from database rules.
   */
  static async determineSteps(
    documentType: WorkflowDocumentType,
    amount: number
  ): Promise<ApprovalStep[]> {
    await this.initRulesIfEmpty();

    const activeRules = await db.approvalRules
      .where('documentType')
      .equals(documentType)
      .filter((r) => !r.isDeleted && r.isActive)
      .sortBy('minAmount');

    // Find the rule whose bracket covers this amount
    const matchedRule = activeRules.find((r) => {
      return amount >= r.minAmount && (amount <= r.maxAmount || r.maxAmount >= 999999999);
    });

    if (matchedRule && matchedRule.steps && matchedRule.steps.length > 0) {
      return matchedRule.steps.map((st) => ({
        stepNumber: st.stepNumber,
        roleCode: st.roleCode,
        roleName: st.roleName,
        status: 'pending',
      }));
    }

    // Fallback: If amount exceeds all configured max bounds, use highest tier rule
    if (activeRules.length > 0) {
      const highestRule = activeRules[activeRules.length - 1];
      return highestRule.steps.map((st) => ({
        stepNumber: st.stepNumber,
        roleCode: st.roleCode,
        roleName: st.roleName,
        status: 'pending',
      }));
    }

    // Default safety fallback if DB is completely unconfigured
    return [
      {
        stepNumber: 1,
        roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER,
        roleName: 'مدير المشتريات',
        status: 'pending',
      },
      {
        stepNumber: 2,
        roleCode: SYSTEM_ROLES.ADMIN,
        roleName: 'مدير النظام',
        status: 'pending',
      },
    ];
  }
}
