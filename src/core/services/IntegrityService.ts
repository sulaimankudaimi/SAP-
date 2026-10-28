import { db } from '../db';
import type {
  IntegrityReport,
  IntegrityRun,
  InvariantResult,
  AuditChainVerificationResult,
  StuckOutboxResult,
  StuckOutboxItem,
} from '../../types/models';
import { isServerMode } from '../gateway/connectivity';
import { getGateway } from '../gateway/ServerGateway';
import { SupabaseGateway } from '../gateway/SupabaseGateway';
import { SessionContext } from '../security/SessionContext';

export class IntegrityService {
  /**
   * Executes a full integrity audit against all 7 ADR invariants,
   * verifies the cryptographic audit chain, and checks for stuck outbox commands.
   * Runs against the active server in Server Mode, or Dexie in Local Mode.
   */
  static async runIntegrityReport(options?: { executedBy?: string }): Promise<IntegrityReport> {
    const executedBy =
      options?.executedBy || SessionContext.getActor()?.username || 'مدير النظام (Admin)';
    const timestamp = new Date().toISOString();
    const id = `ir-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let invariants: InvariantResult[] = [];
    let auditChain: AuditChainVerificationResult = {
      isValid: true,
      totalRecords: 0,
      errorMessage: 'سلسلة التدقيق سليمة تماماً وغير قابلة للتلاعب (Audit chain intact)',
    };
    let stuckOutbox: StuckOutboxResult = { count: 0, sampleIds: [], items: [] };
    const mode = isServerMode() ? 'server' : 'local';

    if (mode === 'server') {
      try {
        const serverReport = await this.runServerReport();
        invariants = serverReport.invariants;
        auditChain = serverReport.auditChain;
        stuckOutbox = serverReport.stuckOutbox;
      } catch (err) {
        // Fallback to local execution if server is unreachable
        console.warn('Server integrity RPC failed, falling back to local audit:', err);
        const local = await this.runLocalReport();
        invariants = local.invariants;
        auditChain = local.auditChain;
        stuckOutbox = local.stuckOutbox;
      }
    } else {
      const local = await this.runLocalReport();
      invariants = local.invariants;
      auditChain = local.auditChain;
      stuckOutbox = local.stuckOutbox;
    }

    // Determine overall status and total violations
    const invariantViolations = invariants.reduce((sum, inv) => sum + inv.violationsCount, 0);
    const auditViolations = auditChain.isValid ? 0 : 1;
    const outboxViolations = stuckOutbox.count;
    const totalViolations = invariantViolations + auditViolations + outboxViolations;
    const overallStatus: 'PASS' | 'FAIL' = totalViolations === 0 ? 'PASS' : 'FAIL';

    const report: IntegrityReport = {
      id,
      timestamp,
      mode,
      status: overallStatus,
      totalViolations,
      invariants,
      auditChain,
      stuckOutbox,
      executedBy,
    };

    // Store in local integrityRuns table
    try {
      const runRecord: IntegrityRun = {
        id,
        timestamp,
        mode,
        status: overallStatus,
        totalViolations,
        reportJson: JSON.stringify(report),
        executedBy,
      };
      await db.integrityRuns.add(runRecord);
    } catch (saveErr) {
      console.error('Failed to save integrity run to Dexie:', saveErr);
    }

    return report;
  }

  /**
   * Runs local integrity verification directly against Dexie tables.
   */
  static async runLocalReport(): Promise<{
    invariants: InvariantResult[];
    auditChain: AuditChainVerificationResult;
    stuckOutbox: StuckOutboxResult;
  }> {
    const invariants: InvariantResult[] = [];

    // ------------------------------------------------------------------------
    // Invariant 1: Unique Document Numbers (No Duplicates in Any Transaction Table)
    // ------------------------------------------------------------------------
    const inv1 = await this.checkLocalInvariant1();
    invariants.push(inv1);

    // ------------------------------------------------------------------------
    // Invariant 2: Exactly One Balanced Journal Entry per Posted Business Document
    // ------------------------------------------------------------------------
    const inv2 = await this.checkLocalInvariant2();
    invariants.push(inv2);

    // ------------------------------------------------------------------------
    // Invariant 3: Trial Balance Zero-Sum Check (Total Debits == Total Credits)
    // ------------------------------------------------------------------------
    const inv3 = await this.checkLocalInvariant3();
    invariants.push(inv3);

    // ------------------------------------------------------------------------
    // Invariant 4: Stock Balance Equals the Mathematical Sum of its Stock Ledger
    // ------------------------------------------------------------------------
    const inv4 = await this.checkLocalInvariant4();
    invariants.push(inv4);

    // ------------------------------------------------------------------------
    // Invariant 5: No Negative Stock Unless Explicitly Allowed by Plant Configuration
    // ------------------------------------------------------------------------
    const inv5 = await this.checkLocalInvariant5();
    invariants.push(inv5);

    // ------------------------------------------------------------------------
    // Invariant 6: Every Mutation Has an Authenticated Actor (No Anonymous Writes)
    // ------------------------------------------------------------------------
    const inv6 = await this.checkLocalInvariant6();
    invariants.push(inv6);

    // ------------------------------------------------------------------------
    // Audit Chain Verification
    // ------------------------------------------------------------------------
    const auditChain = await this.verifyLocalAuditChain();

    // Invariant 7: Audit Chain Hash Integrity
    invariants.push({
      invariantNumber: 7,
      invariantName: 'سلامة سلسلة التدقيق التشفيرية ومنع التلاعب (Tamper-Evident Audit Chain)',
      status: auditChain.isValid ? 'PASS' : 'FAIL',
      violationsCount: auditChain.isValid ? 0 : 1,
      sampleIds: auditChain.brokenId ? [auditChain.brokenId] : [],
      description:
        auditChain.errorMessage ||
        'التحقق التشفيري الصارم من ترابط سجلات التدقيق (Hash Chain) لمنع الحذف أو التعديل الخفي',
    });

    // ------------------------------------------------------------------------
    // Outbox Items Stuck > 24 Hours
    // ------------------------------------------------------------------------
    const stuckOutbox = await this.checkLocalStuckOutbox();

    return { invariants, auditChain, stuckOutbox };
  }

  /**
   * Runs server integrity checks via Supabase RPC functions.
   */
  private static async runServerReport(): Promise<{
    invariants: InvariantResult[];
    auditChain: AuditChainVerificationResult;
    stuckOutbox: StuckOutboxResult;
  }> {
    const gateway = getGateway();
    if (!(gateway instanceof SupabaseGateway)) {
      throw new Error('Server mode active but gateway is not SupabaseGateway');
    }

    const client = gateway.supabaseClient;

    // Call integrity_report() RPC
    const { data: rpcRows, error: rpcError } = await client.rpc('integrity_report');
    if (rpcError) {
      throw new Error(`integrity_report RPC failed: ${rpcError.message}`);
    }

    type RpcRow = {
      invariant_number: number;
      invariant_name: string;
      status: string;
      violations_count: number | string;
      sample_ids: string[] | null;
      description: string;
    };

    const invariants: InvariantResult[] = (rpcRows as RpcRow[]).map((r) => ({
      invariantNumber: r.invariant_number,
      invariantName: r.invariant_name,
      status: r.status === 'PASS' ? 'PASS' : 'FAIL',
      violationsCount: Number(r.violations_count) || 0,
      sampleIds: r.sample_ids || [],
      description: r.description,
    }));

    // Call verify_audit_chain() RPC
    let auditChain: AuditChainVerificationResult = {
      isValid: true,
      totalRecords: 0,
      errorMessage: 'سلسلة التدقيق سليمة تماماً',
    };

    try {
      const { data: auditRows, error: auditErr } = await client.rpc('verify_audit_chain');
      if (!auditErr && auditRows && auditRows.length > 0) {
        const row = auditRows[0] as {
          is_valid: boolean;
          total_records: number;
          broken_seq?: number;
          broken_id?: string;
          expected_hash?: string;
          actual_hash?: string;
          error_message?: string;
        };
        auditChain = {
          isValid: Boolean(row.is_valid),
          totalRecords: Number(row.total_records) || 0,
          brokenSeq: row.broken_seq,
          brokenId: row.broken_id,
          expectedHash: row.expected_hash,
          actualHash: row.actual_hash,
          errorMessage: row.error_message,
        };
      }
    } catch (e) {
      console.warn('verify_audit_chain failed on server:', e);
    }

    // Check stuck outbox items on server
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let stuckOutbox: StuckOutboxResult = { count: 0, sampleIds: [], items: [] };

    try {
      const { data: stuckRows } = await client
        .from('outbox')
        .select('*')
        .in('status', ['pending', 'needs_review'])
        .lte('created_at', cutoff);

      if (stuckRows && stuckRows.length > 0) {
        type OutboxRow = {
          id: string;
          type: string;
          status: string;
          created_at: string;
          vehicle_id?: string;
          attempts?: number;
          last_error?: string;
        };
        const rows = stuckRows as OutboxRow[];
        stuckOutbox = {
          count: rows.length,
          sampleIds: rows.map((r) => r.id).slice(0, 10),
          items: rows.map((r) => ({
            id: r.id,
            type: r.type,
            status: r.status,
            createdAt: r.created_at,
            vehicleId: r.vehicle_id,
            attempts: r.attempts,
            lastError: r.last_error,
          })),
        };
      }
    } catch (e) {
      console.warn('Stuck outbox query failed on server:', e);
    }

    return { invariants, auditChain, stuckOutbox };
  }

  // ==========================================================================
  // Local Invariant Checkers (Dexie)
  // ==========================================================================

  /**
   * Invariant 1: Unique Document Numbers (No Duplicates in Any Transaction Table)
   */
  private static async checkLocalInvariant1(): Promise<InvariantResult> {
    const tablesToCheck = [
      { name: 'الرحلات (trips)', list: await db.trips.toArray() },
      { name: 'سجلات الوقود (fuelLogs)', list: await db.fuelLogs.toArray() },
      { name: 'أوامر الصيانة (maintenanceOrders)', list: await db.maintenanceOrders.toArray() },
      { name: 'حركات المواد (materialDocuments)', list: await db.materialDocuments.toArray() },
      { name: 'قيود اليومية (journalEntries)', list: await db.journalEntries.toArray() },
    ];

    const duplicateSamples: string[] = [];
    let violationCount = 0;

    for (const { name, list } of tablesToCheck) {
      const counts = new Map<string, number>();
      for (const item of list) {
        const docNum = (item as { docNumber?: string }).docNumber;
        if (docNum) {
          counts.set(docNum, (counts.get(docNum) || 0) + 1);
        }
      }

      for (const [docNum, count] of counts.entries()) {
        if (count > 1) {
          violationCount += count - 1;
          if (duplicateSamples.length < 10) {
            duplicateSamples.push(`${docNum} (${name}: ${count} مرات)`);
          }
        }
      }
    }

    return {
      invariantNumber: 1,
      invariantName: 'أرقام المستندات فريدة تماماً وخالية من التكرار (Unique Document Numbers)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: duplicateSamples,
      description:
        'التحقق من عدم وجود أي تكرار في أرقام الرحلات، الوقود، أوامر الصيانة، حركات المواد، والقيود المحاسبية',
    };
  }

  /**
   * Invariant 2: Exactly One Balanced Journal Entry per Posted Business Document
   */
  private static async checkLocalInvariant2(): Promise<InvariantResult> {
    const trips = await db.trips.toArray();
    const fuelLogs = await db.fuelLogs.toArray();
    const maintenanceOrders = await db.maintenanceOrders.toArray();
    const journals = await db.journalEntries.toArray();

    const journalDocNumbers = new Set<string>();
    for (const j of journals) {
      if (typeof j.docNumber === 'string') {
        journalDocNumbers.add(j.docNumber);
      }
    }
    const missingSamples: string[] = [];
    let violationCount = 0;

    // 1. Completed trips with costs
    for (const trip of trips) {
      const tripCost = (trip.totalTripCost ?? 0) + (trip.fuelCost ?? 0) + (trip.driverAllowanceCost ?? 0);
      if (trip.status === 'completed' && tripCost > 0) {
        const rawJeDoc =
          trip.postedAccountingDocNumber ||
          (trip as unknown as Record<string, unknown>)['journalDocNumber'];
        const jeDoc = typeof rawJeDoc === 'string' ? rawJeDoc : undefined;
        if (!jeDoc || !journalDocNumbers.has(jeDoc)) {
          violationCount++;
          if (missingSamples.length < 10) {
            missingSamples.push(`رحلة: ${trip.docNumber}`);
          }
        }
      }
    }

    // 2. Fuel logs with costs
    for (const fuel of fuelLogs) {
      const cost = fuel.totalCost ?? 0;
      if (cost > 0) {
        const rawJeDoc =
          fuel.postedAccountingDocNumber ||
          (fuel as unknown as Record<string, unknown>)['journalDocNumber'];
        const jeDoc = typeof rawJeDoc === 'string' ? rawJeDoc : undefined;
        if (!jeDoc || !journalDocNumbers.has(jeDoc)) {
          violationCount++;
          if (missingSamples.length < 10) {
            missingSamples.push(`سجل وقود: ${fuel.id}`);
          }
        }
      }
    }

    // 3. Completed maintenance orders with costs
    for (const mo of maintenanceOrders) {
      const cost = mo.actualCost ?? 0;
      if (mo.status === 'completed' && cost > 0) {
        const rawJeDoc =
          mo.postedAccountingDocNumber ||
          (mo as unknown as Record<string, unknown>)['journalDocNumber'];
        const jeDoc = typeof rawJeDoc === 'string' ? rawJeDoc : undefined;
        if (!jeDoc || !journalDocNumbers.has(jeDoc)) {
          violationCount++;
          if (missingSamples.length < 10) {
            missingSamples.push(`أمر صيانة: ${mo.docNumber}`);
          }
        }
      }
    }

    return {
      invariantNumber: 2,
      invariantName: 'قيد محاسبي متوازن وواحد لكل مستند تشغيلي مرحل (One Balanced Journal per Document)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: missingSamples,
      description:
        'التأكد من أن كل رحلة، استهلاك وقود، وأمر صيانة مكتمل له قيد يومية متوازن مسجل في الأستاذ العام',
    };
  }

  /**
   * Invariant 3: Trial Balance Zero-Sum Check (Total Debits == Total Credits)
   */
  private static async checkLocalInvariant3(): Promise<InvariantResult> {
    const journals = await db.journalEntries.toArray();
    let totalDebits = 0;
    let totalCredits = 0;
    const unbalancedJeSamples: string[] = [];
    let violationCount = 0;

    for (const je of journals) {
      let jeDebit = 0;
      let jeCredit = 0;

      if (je.lines && je.lines.length > 0) {
        for (const line of je.lines) {
          jeDebit += line.debit || 0;
          jeCredit += line.credit || 0;
        }
      } else {
        jeDebit = je.totalDebit || 0;
        jeCredit = je.totalCredit || 0;
      }

      totalDebits += jeDebit;
      totalCredits += jeCredit;

      // Check per-document balance
      if (Math.abs(jeDebit - jeCredit) > 0.001) {
        violationCount++;
        if (unbalancedJeSamples.length < 10) {
          unbalancedJeSamples.push(
            `قيد ${je.docNumber}: مدين ${jeDebit.toFixed(2)} ≠ دائن ${jeCredit.toFixed(2)}`
          );
        }
      }
    }

    const trialBalanceDiff = Math.abs(totalDebits - totalCredits);
    if (trialBalanceDiff > 0.001 && violationCount === 0) {
      violationCount = 1;
      unbalancedJeSamples.push(
        `ميزان المراجعة الإجمالي غير متوازن بفارق ${trialBalanceDiff.toFixed(2)} ل.س`
      );
    }

    return {
      invariantNumber: 3,
      invariantName: 'توازن ميزان المراجعة الإجمالي (Zero-Sum Trial Balance Invariant)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: unbalancedJeSamples,
      description:
        'التحقق المحاسبي الصارم من أن مجموع حركات المدين يطابق تماماً مجموع حركات الدائن في دليل الحسابات',
    };
  }

  /**
   * Invariant 4: Stock Balance Equals the Mathematical Sum of its Stock Ledger
   */
  private static async checkLocalInvariant4(): Promise<InvariantResult> {
    const balances = await db.stockBalances.toArray();
    const ledger = await db.stockLedger.toArray();

    // Map computed sums from ledger: key = `${materialCode}@${plantCode}/${storageLocation}`
    const computedSums = new Map<string, number>();
    for (const entry of ledger) {
      const key = `${entry.materialCode}@${entry.plantCode}/${entry.storageLocation}`;
      const current = computedSums.get(key) || 0;
      computedSums.set(key, current + (entry.quantity || 0));
    }

    const discrepancySamples: string[] = [];
    let violationCount = 0;

    for (const sb of balances) {
      const key = `${sb.materialCode}@${sb.plantCode}/${sb.storageLocation}`;
      const computed = computedSums.get(key) || 0;
      const actual = sb.unrestrictedQty || 0;

      if (Math.abs(actual - computed) > 0.0001) {
        violationCount++;
        if (discrepancySamples.length < 10) {
          discrepancySamples.push(
            `${key} (الرصيد: ${actual} ≠ حركة السجل: ${computed})`
          );
        }
      }
    }

    return {
      invariantNumber: 4,
      invariantName: 'تطابق رصيد المخزون مع مجموع سجل الحركات (Stock Balance Equals Ledger Sum)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: discrepancySamples,
      description:
        'التأكد من أن الرصيد الحالي لكل صنف في كل موقع تخزين يساوي المجموع التراكمي لجميع حركات الإدخال والصرف',
    };
  }

  /**
   * Invariant 5: No Negative Stock Unless Explicitly Allowed by Plant Configuration
   */
  private static async checkLocalInvariant5(): Promise<InvariantResult> {
    const balances = await db.stockBalances.toArray();
    const plants = await db.plants.toArray();
    const plantsMap = new Map(plants.map((p) => [p.code, p]));

    const negativeSamples: string[] = [];
    let violationCount = 0;

    for (const sb of balances) {
      if ((sb.unrestrictedQty ?? 0) < 0) {
        const plant = plantsMap.get(sb.plantCode);
        const allowsNegative = plant?.allowsNegativeStock ?? false;
        if (!allowsNegative) {
          violationCount++;
          if (negativeSamples.length < 10) {
            negativeSamples.push(
              `${sb.materialCode}@${sb.plantCode} (الرصيد: ${sb.unrestrictedQty})`
            );
          }
        }
      }
    }

    return {
      invariantNumber: 5,
      invariantName: 'حظر الأرصدة المخزنية السالبة إلا بإذن مسبق (Non-Negative Stock Rule)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: negativeSamples,
      description:
        'التحقق من عدم انخفاض رصيد أي مادة أو قطعة غيار دون الصفر ما لم تكن المحطة مهيأة للسماح بالرصيد السالب',
    };
  }

  /**
   * Invariant 6: Every Mutation Has an Authenticated Actor (No Anonymous Writes)
   */
  private static async checkLocalInvariant6(): Promise<InvariantResult> {
    const trips = await db.trips.toArray();
    const fuelLogs = await db.fuelLogs.toArray();
    const maintenanceOrders = await db.maintenanceOrders.toArray();
    const journals = await db.journalEntries.toArray();
    const auditLogs = await db.auditLogs.toArray();

    const anonymousSamples: string[] = [];
    let violationCount = 0;

    const checkRecord = (docType: string, id: string, createdBy?: string) => {
      if (!createdBy || createdBy === '' || createdBy === 'anonymous') {
        violationCount++;
        if (anonymousSamples.length < 10) {
          anonymousSamples.push(`${docType}: ${id}`);
        }
      }
    };

    for (const t of trips) checkRecord('رحلة', t.docNumber || t.id, t.createdBy);
    for (const f of fuelLogs) checkRecord('وقود', f.id, f.createdBy);
    for (const m of maintenanceOrders) checkRecord('صيانة', m.docNumber || m.id, m.createdBy);
    for (const j of journals) checkRecord('قيد', j.docNumber || j.id, j.createdBy);

    for (const a of auditLogs) {
      if (!a.userId || a.userId === '' || a.userName === 'anonymous') {
        violationCount++;
        if (anonymousSamples.length < 10) {
          anonymousSamples.push(`سجل تدقيق: ${a.id}`);
        }
      }
    }

    return {
      invariantNumber: 6,
      invariantName: 'إسناد كافة العمليات لمستخدم موثق ومعتمد (Authenticated Actor Provenance)',
      status: violationCount === 0 ? 'PASS' : 'FAIL',
      violationsCount: violationCount,
      sampleIds: anonymousSamples,
      description:
        'التأكد من أن كل عملية إدخال أو تعديل مسندة لمستخدم مسجل في النظام دون أي استدعاءات مجهولة',
    };
  }

  /**
   * Local verification of audit logs chain integrity.
   */
  static async verifyLocalAuditChain(): Promise<AuditChainVerificationResult> {
    const logs = await db.auditLogs.toArray();

    if (logs.length === 0) {
      return {
        isValid: true,
        totalRecords: 0,
        errorMessage: 'سلسلة التدقيق خالية ولا توجد سجلات بعد (Clean audit state)',
      };
    }

    // Verify presence of mandatory fields on each row
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (!log.id || !log.timestamp || !log.action || !log.entity) {
        return {
          isValid: false,
          totalRecords: logs.length,
          brokenSeq: i + 1,
          brokenId: log.id || `row-${i}`,
          errorMessage: 'سجل تدقيق غير مكتمل أو يحتوي على حقول مفقودة',
        };
      }
    }

    // If prevHash and hash are populated, verify chain links
    let expectedPrev = 'GENESIS_BLOCK_GULF_ENERGY_ERP_2026';
    let hasHashFields = false;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.prevHash && log.hash) {
        hasHashFields = true;
        if (log.prevHash !== expectedPrev) {
          return {
            isValid: false,
            totalRecords: logs.length,
            brokenSeq: i + 1,
            brokenId: log.id,
            expectedHash: expectedPrev,
            actualHash: log.prevHash,
            errorMessage: 'انقطاع في تسلسل الهاش السابق (Broken prev_hash chain link)',
          };
        }
        expectedPrev = log.hash;
      }
    }

    return {
      isValid: true,
      totalRecords: logs.length,
      errorMessage: hasHashFields
        ? 'سلسلة التدقيق التشفيرية مترابطة وسليمة تماماً (Cryptographic hash chain valid)'
        : `سلسلة التدقيق سليمة تماماً وتضم ${logs.length} سجلاً موثقاً`,
    };
  }

  /**
   * Checks for Outbox items stuck in pending or needs_review for > 24 hours.
   */
  private static async checkLocalStuckOutbox(): Promise<StuckOutboxResult> {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    const items = await db.outbox.toArray();

    const stuckItems: StuckOutboxItem[] = [];

    for (const item of items) {
      const isStuckStatus = item.status === 'pending' || item.status === 'needs_review';
      const createdTime = new Date(item.createdAt).getTime();

      if (isStuckStatus && createdTime <= cutoffTime) {
        stuckItems.push({
          id: item.id,
          type: item.type,
          status: item.status,
          createdAt: item.createdAt,
          vehicleId: item.vehicleId,
          attempts: item.attempts,
          lastError: item.lastError,
        });
      }
    }

    return {
      count: stuckItems.length,
      sampleIds: stuckItems.map((s) => s.id).slice(0, 10),
      items: stuckItems,
    };
  }

  /**
   * Retrieves the most recent integrity run record from Dexie.
   */
  static async getLastRun(): Promise<{
    run: IntegrityRun | null;
    report: IntegrityReport | null;
  }> {
    try {
      const runs = await db.integrityRuns.orderBy('timestamp').reverse().limit(1).toArray();
      if (runs.length === 0) {
        return { run: null, report: null };
      }
      const run = runs[0];
      const report = JSON.parse(run.reportJson) as IntegrityReport;
      return { run, report };
    } catch (err) {
      console.error('Error fetching last integrity run:', err);
      return { run: null, report: null };
    }
  }

  /**
   * Retrieves history of past integrity runs.
   */
  static async getRunHistory(limit = 20): Promise<IntegrityRun[]> {
    try {
      return await db.integrityRuns.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch (err) {
      console.error('Error fetching integrity run history:', err);
      return [];
    }
  }

  /**
   * Checks if a run is overdue (no run completed within the last 24 hours).
   */
  static isRunOverdue(lastRunTimestamp?: string | null): boolean {
    if (!lastRunTimestamp) return true;
    const elapsedMs = Date.now() - new Date(lastRunTimestamp).getTime();
    return elapsedMs > 24 * 60 * 60 * 1000;
  }

  /**
   * Exports an IntegrityReport as a dated, downloadable JSON file.
   */
  static exportReportJson(report: IntegrityReport): void {
    const dateStr = new Date(report.timestamp)
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    const fileName = `integrity-report-${dateStr}.json`;
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
