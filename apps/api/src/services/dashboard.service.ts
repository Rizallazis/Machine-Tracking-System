import {
  DashboardSummary,
  DashboardByLocation,
  DashboardByCategory,
  MachineStatus,
  MachineCondition
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';

export class DashboardService {
  /**
   * Load dashboard data with one shared machine read instead of each widget
   * independently fetching the entire machine sheet.
   */
  static async getOverview(): Promise<{
    summary: DashboardSummary;
    byLocation: DashboardByLocation[];
    byCategory: DashboardByCategory[];
  }> {
    const repo = getSheetsRepository();
    const [machines, movements, locations, categories] = await Promise.all([
      repo.getMachines(),
      repo.getMovements(),
      repo.getLocations(),
      repo.getCategories()
    ]);

    const activeMachines = machines.filter(m => m.Active);
    const statusCounts: Record<MachineStatus, number> = {
      [MachineStatus.AVAILABLE]: 0,
      [MachineStatus.IN_USE]: 0,
      [MachineStatus.IDLE]: 0,
      [MachineStatus.UNDER_REPAIR]: 0,
      [MachineStatus.BORROWED]: 0,
      [MachineStatus.RETIRED]: 0
    };
    const conditionCounts: Record<MachineCondition, number> = {
      [MachineCondition.NORMAL]: 0,
      [MachineCondition.NEEDS_INSPECTION]: 0,
      [MachineCondition.DAMAGED]: 0
    };

    for (const machine of activeMachines) {
      if (statusCounts[machine.Current_Status] !== undefined) statusCounts[machine.Current_Status]++;
      if (conditionCounts[machine.Machine_Condition] !== undefined) conditionCounts[machine.Machine_Condition]++;
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayMovements = movements.filter(m => m.Movement_DateTime.startsWith(today));
    const summary: DashboardSummary = {
      totalMachines: machines.length,
      activeMachines: activeMachines.length,
      statusCounts,
      conditionCounts,
      totalMovementsToday: todayMovements.length,
      recentMovements: movements.slice(0, 10)
    };

    const byLocation: DashboardByLocation[] = locations.map(location => {
      const locationMachines = activeMachines.filter(m => m.Current_Location_ID === location.Location_ID);
      return {
        locationId: location.Location_ID,
        locationName: location.Location_Name,
        line: location.Line,
        building: location.Building,
        count: locationMachines.length,
        inUseCount: locationMachines.filter(m => m.Current_Status === MachineStatus.IN_USE).length,
        underRepairCount: locationMachines.filter(m => m.Current_Status === MachineStatus.UNDER_REPAIR).length
      };
    });

    const byCategory: DashboardByCategory[] = categories.map(category => ({
      categoryId: category.Category_ID,
      categoryName: category.Category_Name,
      department: category.Department,
      count: activeMachines.filter(m => m.Category_ID === category.Category_ID).length
    }));

    return { summary, byLocation, byCategory };
  }
  static async getSummary(): Promise<DashboardSummary> {
    const repo = getSheetsRepository();
    const [machines, movements] = await Promise.all([
      repo.getMachines(),
      repo.getMovements()
    ]);

    const activeMachines = machines.filter(m => m.Active);

    const statusCounts: Record<MachineStatus, number> = {
      [MachineStatus.AVAILABLE]: 0,
      [MachineStatus.IN_USE]: 0,
      [MachineStatus.IDLE]: 0,
      [MachineStatus.UNDER_REPAIR]: 0,
      [MachineStatus.BORROWED]: 0,
      [MachineStatus.RETIRED]: 0
    };

    const conditionCounts: Record<MachineCondition, number> = {
      [MachineCondition.NORMAL]: 0,
      [MachineCondition.NEEDS_INSPECTION]: 0,
      [MachineCondition.DAMAGED]: 0
    };

    for (const m of activeMachines) {
      if (statusCounts[m.Current_Status] !== undefined) {
        statusCounts[m.Current_Status]++;
      }
      if (conditionCounts[m.Machine_Condition] !== undefined) {
        conditionCounts[m.Machine_Condition]++;
      }
    }

    // Count today's movements
    const today = new Date().toISOString().slice(0, 10);
    const todayMovements = movements.filter(m => m.Movement_DateTime.startsWith(today));

    return {
      totalMachines: machines.length,
      activeMachines: activeMachines.length,
      statusCounts,
      conditionCounts,
      totalMovementsToday: todayMovements.length,
      recentMovements: movements.slice(0, 10)
    };
  }

  static async getByLocation(): Promise<DashboardByLocation[]> {
    const repo = getSheetsRepository();
    const [locations, machines] = await Promise.all([
      repo.getLocations(),
      repo.getMachines({ activeOnly: true })
    ]);

    return locations.map(loc => {
      const locMachines = machines.filter(m => m.Current_Location_ID === loc.Location_ID);
      const inUseCount = locMachines.filter(m => m.Current_Status === MachineStatus.IN_USE).length;
      const underRepairCount = locMachines.filter(m => m.Current_Status === MachineStatus.UNDER_REPAIR).length;

      return {
        locationId: loc.Location_ID,
        locationName: loc.Location_Name,
        line: loc.Line,
        building: loc.Building,
        count: locMachines.length,
        inUseCount,
        underRepairCount
      };
    });
  }

  static async getByCategory(): Promise<DashboardByCategory[]> {
    const repo = getSheetsRepository();
    const [categories, machines] = await Promise.all([
      repo.getCategories(),
      repo.getMachines({ activeOnly: true })
    ]);

    return categories.map(cat => {
      const catMachines = machines.filter(m => m.Category_ID === cat.Category_ID);
      return {
        categoryId: cat.Category_ID,
        categoryName: cat.Category_Name,
        department: cat.Department,
        count: catMachines.length
      };
    });
  }
}
