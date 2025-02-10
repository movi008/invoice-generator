import { format, parseISO } from 'date-fns';

export interface ActivityData {
  project: string;
  workers: string;
  activity: string;
  upwork_hours: number;
}

export interface WorkerRate {
  name: string;
  rate: number;
}

export interface ClientInfo {
  name: string;
  company: string;
  location: string;
}

export interface PayableTo {
  name: string;
  agency: string;
  location: string;
}

export interface WorkerSummary {
  name: string;
  totalHours: number;
  totalAmount: number;
}

export function processCsvData(csvData: string): ActivityData[] {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      project: values[0],
      workers: values[1],
      activity: values[2],
      upwork_hours: parseFloat(values[4])
    };
  }).filter(data => data.project && data.workers);
}

export function calculateTotalsByProject(activities: ActivityData[], workerRates: WorkerRate[]) {
  return activities.reduce((acc, curr) => {
    if (!acc[curr.project]) {
      acc[curr.project] = {
        totalHours: 0,
        totalAmount: 0,
        activities: [],
        workerSummaries: {} as Record<string, WorkerSummary>
      };
    }
    
    const workerRate = workerRates.find(w => w.name === curr.workers);
    const rate = workerRate?.rate || 0;
    const amount = curr.upwork_hours * rate;
    
    // Update project totals
    acc[curr.project].totalHours += curr.upwork_hours;
    acc[curr.project].totalAmount += amount;
    acc[curr.project].activities.push({
      ...curr,
      workerRate: rate,
      amount
    });
    
    // Update worker summaries
    if (!acc[curr.project].workerSummaries[curr.workers]) {
      acc[curr.project].workerSummaries[curr.workers] = {
        name: curr.workers,
        totalHours: 0,
        totalAmount: 0
      };
    }
    acc[curr.project].workerSummaries[curr.workers].totalHours += curr.upwork_hours;
    acc[curr.project].workerSummaries[curr.workers].totalAmount += amount;
    
    return acc;
  }, {} as Record<string, { 
    totalHours: number;
    totalAmount: number;
    activities: (ActivityData & { workerRate: number; amount: number; })[],
    workerSummaries: Record<string, WorkerSummary>
  }>);
}