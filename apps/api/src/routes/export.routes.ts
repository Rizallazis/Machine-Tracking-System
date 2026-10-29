import { Router, Request, Response, NextFunction } from 'express';
import { MachineService } from '../services/machine.service';
import { MovementService } from '../services/movement.service';
import { authenticate } from '../middleware/auth.middleware';

export const exportRouter = Router();

export const formatCSV = (headers: string[], rows: any[][]): string => {
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
};

exportRouter.use(authenticate);

exportRouter.get('/machines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const machines = await MachineService.getMachines({ activeOnly: false });

    const headers = [
      'Machine_ID', 'QR_Token', 'Machine_Name', 'Category', 'Brand', 'Model',
      'Serial_Number', 'Asset_Number', 'Purchase_Date', 'Current_Location',
      'Building', 'Line', 'Current_PIC', 'Status', 'Condition', 'Created_At', 'Active', 'Notes'
    ];

    const rows = machines.map(m => [
      m.Machine_ID,
      m.QR_Token,
      m.Machine_Name,
      m.Category_Name,
      m.Brand,
      m.Model,
      m.Serial_Number,
      m.Asset_Number,
      m.Purchase_Date,
      m.Location_Name,
      m.Location_Building,
      m.Location_Line,
      m.PIC_Name,
      m.Current_Status,
      m.Machine_Condition,
      m.Created_At,
      m.Active ? 'TRUE' : 'FALSE',
      m.Notes
    ]);

    const csv = formatCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="machines-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

exportRouter.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const movements = await MovementService.getMovements();

    const headers = [
      'Movement_ID', 'Machine_ID', 'From_Location_ID', 'To_Location_ID',
      'Old_PIC_ID', 'New_PIC_ID', 'Movement_DateTime', 'Movement_Reason',
      'Requested_By', 'Status', 'Notes', 'Request_ID'
    ];

    const rows = movements.map(m => [
      m.Movement_ID,
      m.Machine_ID,
      m.From_Location_ID,
      m.To_Location_ID,
      m.Old_PIC_ID,
      m.New_PIC_ID,
      m.Movement_DateTime,
      m.Movement_Reason,
      m.Requested_By,
      m.Status,
      m.Notes,
      m.Request_ID
    ]);

    const csv = formatCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="movements-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
