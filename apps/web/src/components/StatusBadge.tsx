import React from 'react';
import {
  MachineStatus,
  MachineCondition,
  ConditionType,
  MovementStatus,
  MachineStatusLabel,
  MachineConditionLabel
} from '@machine-tracking/shared';

interface StatusBadgeProps {
  status?: MachineStatus;
  condition?: MachineCondition | ConditionType;
  movementStatus?: MovementStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  condition,
  movementStatus,
  className = ''
}) => {
  if (status) {
    const colorClasses: Record<MachineStatus, string> = {
      [MachineStatus.AVAILABLE]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [MachineStatus.IN_USE]: 'bg-blue-50 text-blue-700 border-blue-200',
      [MachineStatus.IDLE]: 'bg-amber-50 text-amber-700 border-amber-200',
      [MachineStatus.UNDER_REPAIR]: 'bg-rose-50 text-rose-700 border-rose-200',
      [MachineStatus.BORROWED]: 'bg-purple-50 text-purple-700 border-purple-200',
      [MachineStatus.RETIRED]: 'bg-slate-100 text-slate-600 border-slate-300'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses[status] || 'bg-slate-100 text-slate-700'} ${className}`}>
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
        {MachineStatusLabel[status] || status}
      </span>
    );
  }

  if (condition) {
    const colorClasses: Record<MachineCondition, string> = {
      [MachineCondition.NORMAL]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [MachineCondition.NEEDS_INSPECTION]: 'bg-amber-50 text-amber-700 border-amber-200',
      [MachineCondition.DAMAGED]: 'bg-rose-50 text-rose-700 border-rose-200'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colorClasses[condition] || 'bg-slate-100 text-slate-700'} ${className}`}>
        {MachineConditionLabel[condition] || condition}
      </span>
    );
  }

  if (movementStatus) {
    const colorClasses: Record<MovementStatus, string> = {
      [MovementStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [MovementStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
      [MovementStatus.REJECTED]: 'bg-rose-50 text-rose-700 border-rose-200'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[movementStatus] || 'bg-slate-100 text-slate-700'} ${className}`}>
        {movementStatus}
      </span>
    );
  }

  return null;
};
