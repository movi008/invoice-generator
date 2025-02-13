import React, { useState } from 'react';
import { Upload, Download, FileDown } from 'lucide-react';
import JSZip from 'jszip';

interface ProcessedData {
  project: string;
  worker: string;
  activity: string;
  duration: number;
  upworkHours: number;
}

interface SummaryData {
  project: string;
  worker: string;
  totalUpworkHours: number;
}

export function ToptalConverter() {
  const [csvData, setCsvData] = useState<ProcessedData[]>([]);
  const [loading, setLoading] = useState(false);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const calculateUpworkHours = (duration: string): number => {
    // Parse duration in format "d" (e.g., "1.5" for 1 hour 30 minutes)
    const hours = parseFloat(duration);
    if (isNaN(hours)) return 0;
    // Round to 2 decimal places for Upwork format
    return Number(hours.toFixed(2));
  };

  const processCSV = (text: string): ProcessedData[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',');
    
    const durationIndex = headers.findIndex(h => h.toLowerCase().includes('d'));
    const projectIndex = headers.findIndex(h => h.toLowerCase().includes('project'));
    const workerIndex = headers.findIndex(h => h.toLowerCase().includes('worker'));
    const activityIndex = headers.findIndex(h => h.toLowerCase().includes('activity'));

    const processedData: ProcessedData[] = [];
    const groupedData: Map<string, ProcessedData> = new Map();

    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      
      const values = line.split(',');
      const duration = values[durationIndex];
      const upworkHours = calculateUpworkHours(duration);
      
      // Process all entries without exclusion
      const project = `${values[projectIndex].trim()} - January 2025`;
      const worker = values[workerIndex].trim();
      const activity = values[activityIndex].trim();
      
      const key = `${project}-${worker}-${activity}`;
      
      if (groupedData.has(key)) {
        const existing = groupedData.get(key)!;
        existing.upworkHours += upworkHours;
      } else {
        groupedData.set(key, {
          project,
          worker,
          activity,
          duration: parseFloat(duration) || 0,
          upworkHours
        });
      }
    });

    return Array.from(groupedData.values());
  };

  const generateCSV = (data: ProcessedData[]): string => {
    const headers = ['Project', 'Worker', 'Activity', 'Duration', 'Upwork Hours'];
    const rows = data.map(item => [
      item.project,
      item.worker,
      item.activity,
      item.duration.toFixed(2),
      item.upworkHours.toFixed(2)
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  const generateSummaryCSV = (data: ProcessedData[]): string => {
    const summaryMap = new Map<string, SummaryData>();
    
    data.forEach(item => {
      const key = `${item.project}-${item.worker}`;
      if (summaryMap.has(key)) {
        const existing = summaryMap.get(key)!;
        existing.totalUpworkHours += item.upworkHours;
      } else {
        summaryMap.set(key, {
          project: item.project,
          worker: item.worker,
          totalUpworkHours: item.upworkHours
        });
      }
    });

    const headers = ['Project', 'Worker', 'Total Upwork Hours'];
    const rows = Array.from(summaryMap.values()).map(item => [
      item.project,
      item.worker,
      item.totalUpworkHours.toFixed(2)
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const processed = processCSV(text);
      setCsvData(processed);
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (csvData.length === 0) return;
    setLoading(true);

    try {
      const zip = new JSZip();
      const workers = new Set(csvData.map(item => item.worker));

      // Generate individual worker files
      workers.forEach(worker => {
        const workerData = csvData.filter(item => item.worker === worker);
        const workerCSV = generateCSV(workerData);
        zip.file(`${worker} - Toptal January 2025.csv`, workerCSV);
      });

      // Generate summary file
      const summaryCSV = generateSummaryCSV(csvData);
      zip.file('Summary - Toptal January 2025.csv', summaryCSV);

      // Generate combined file
      const combinedCSV = generateCSV(csvData);
      zip.file('Combined - Toptal January 2025.csv', combinedCSV);

      // Generate and download zip file
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Toptal January 2025.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating files:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Toptal Converter</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload TopTracker CSV File
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 
                    file:mr-4 file:py-2 file:px-4 
                    file:rounded-md file:border-0 
                    file:text-sm file:font-semibold 
                    file:bg-blue-50 file:text-blue-700 
                    hover:file:bg-blue-100
                    cursor-pointer"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {csvData.length > 0 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FileDown className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        {csvData.length} entries processed and ready for conversion
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConvert}
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-opacity-20 border-t-white mr-2"></div>
                      Converting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Convert and Download Files
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}