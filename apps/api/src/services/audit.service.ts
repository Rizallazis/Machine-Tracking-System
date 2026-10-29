import { v4 as uuidv4 } from 'uuid';
import { LogAudit, AuditResult, AuditAction } from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';

export class AuditService {
  static async log(params: {
    userId: string;
    action: AuditAction | string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    requestId?: string;
    result?: AuditResult;
  }): Promise<LogAudit> {
    const repo = getSheetsRepository();
    const auditRecord: LogAudit = {
      Audit_ID: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      User_ID: params.userId,
      Action: params.action,
      Entity_Type: params.entityType,
      Entity_ID: params.entityId,
      Timestamp: new Date().toISOString(),
      Old_Value: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : '',
      New_Value: params.newValue !== undefined ? JSON.stringify(params.newValue) : '',
      Request_ID: params.requestId || uuidv4(),
      Result: params.result || AuditResult.SUCCESS
    };

    return repo.insertAuditLog(auditRecord);
  }

  static async getLogs(limit = 100): Promise<LogAudit[]> {
    const repo = getSheetsRepository();
    return repo.getAuditLogs(limit);
  }
}
