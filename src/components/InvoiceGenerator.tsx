import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import { format, parse } from 'date-fns';
import { processCsvData, calculateTotalsByProject, ActivityData, WorkerRate, ClientInfo, PayableTo } from '../utils/csvProcessor';
import { generateProjectPage, generateInvoiceHeader, generateTeamSummary, generateProjectsSummary, generateCombinedInvoice } from '../utils/pdfGenerator';
import { Plus, X, Download, FileDown, Upload, LogOut, Eye, EyeOff, Users, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export function InvoiceGenerator() {
  const { signOut } = useAuth();
  const [csvData, setCsvData] = useState<ActivityData[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [workerRates, setWorkerRates] = useState<WorkerRate[]>([{ name: '', rate: 0 }]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [adjustedHours, setAdjustedHours] = useState<Record<string, number>>({});
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, number>>({});
  const [showActivities, setShowActivities] = useState(true);
  const [showAmounts, setShowAmounts] = useState(true);
  const [showTeamSummary, setShowTeamSummary] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: '',
    company: '',
    location: ''
  });
  const [payableTo, setPayableTo] = useState<PayableTo>({
    name: '',
    agency: '',
    location: ''
  });

  const projectTotals = calculateTotalsByProject(csvData, workerRates);
  const projects = Object.keys(projectTotals);
  const uniqueWorkers = Array.from(new Set(csvData.map(data => data.workers))).filter(Boolean);

  useEffect(() => {
    if (csvData.length > 0) {
      const uniqueWorkers = Array.from(new Set(csvData.map(data => data.workers))).filter(Boolean);
      const existingRates = workerRates.reduce((acc, rate) => {
        if (rate.name) acc[rate.name] = rate.rate;
        return acc;
      }, {} as Record<string, number>);

      const newRates = uniqueWorkers.map(worker => ({
        name: worker,
        rate: existingRates[worker] || 0
      }));

      setWorkerRates(newRates);
    }
  }, [csvData]);

  const combinedWorkerTotals = selectedProjects.reduce((acc, project) => {
    const projectData = projectTotals[project];
    Object.values(projectData.workerSummaries).forEach(worker => {
      if (!acc[worker.name]) {
        acc[worker.name] = { totalHours: 0, totalAmount: 0 };
      }
      acc[worker.name].totalHours += worker.totalHours;
      acc[worker.name].totalAmount += worker.totalAmount;
    });
    return acc;
  }, {} as Record<string, { totalHours: number; totalAmount: number }>);

  const adjustedWorkerAmounts = Object.entries(combinedWorkerTotals).reduce((acc, [name, data]) => {
    const workerRate = workerRates.find(w => w.name === name)?.rate || 0;
    const adjustedHour = adjustedHours[name] || data.totalHours;
    acc[name] = adjustedHour * workerRate;
    return acc;
  }, {} as Record<string, number>);

  const totalDifference = Object.entries(combinedWorkerTotals).reduce((total, [name, data]) => {
    const workerRate = workerRates.find(w => w.name === name)?.rate || 0;
    const adjustedHour = adjustedHours[name] || data.totalHours;
    const adjustedAmount = adjustedHour * workerRate;
    return total + (adjustedAmount - data.totalAmount);
  }, 0);

  const projectsSummary = selectedProjects.reduce((acc, project) => {
    const projectData = projectTotals[project];
    const adjustedAmount = adjustedAmounts[project] || 0;
    const finalAmount = projectData.totalAmount - adjustedAmount;
    
    return {
      totalHours: acc.totalHours + projectData.totalHours,
      totalAmount: acc.totalAmount + finalAmount
    };
  }, { totalHours: 0, totalAmount: 0 });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    if (files.length === 0) {
      setCsvData([]);
      return;
    }

    const filePromises = Array.from(files).map(file => {
      return new Promise<ActivityData[]>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const data = processCsvData(text);
          resolve(data);
        };
        reader.readAsText(file);
      });
    });

    Promise.all(filePromises).then(results => {
      const combinedData = results.flat();
      setCsvData(combinedData);
    });
  };

  const handleProjectSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions);
    const selectedValues = selectedOptions.map(option => option.value);
    setSelectedProjects(selectedValues);
  };

  const handleAdjustedHoursChange = (worker: string, hours: string) => {
    setAdjustedHours(prev => ({
      ...prev,
      [worker]: parseFloat(hours) || 0
    }));
  };

  const handleAdjustedAmountChange = (project: string, amount: string) => {
    setAdjustedAmounts(prev => ({
      ...prev,
      [project]: parseFloat(amount) || 0
    }));
  };

  const generateInvoice = (project: string) => {
    const doc = new jsPDF();
    
    generateInvoiceHeader({
      doc,
      selectedMonth,
      clientInfo,
      payableTo
    });
    
    generateProjectPage({
      doc,
      project,
      projectData: projectTotals[project],
      selectedMonth,
      workerRates,
      adjustedAmounts,
      startY: 110,
      showActivities,
      showAmounts
    });

    if (showTeamSummary) {
      const workerTotals = Object.entries(combinedWorkerTotals).reduce((acc, [name, data]) => {
        acc[name] = {
          totalHours: data.totalHours,
          adjustedHours: adjustedHours[name] || data.totalHours
        };
        return acc;
      }, {} as Record<string, { totalHours: number; adjustedHours: number }>);

      generateTeamSummary({
        doc,
        workerTotals,
        showAmounts
      });
    }
    
    doc.save(`${project.toLowerCase().replace(/\s+/g, '-')}-${format(parse(selectedMonth, 'yyyy-MM', new Date()), 'yyyy-MM')}.pdf`);
  };

  const generateCombinedInvoiceHandler = () => {
    const doc = new jsPDF();
    
    const workerTotals = Object.entries(combinedWorkerTotals).reduce((acc, [name, data]) => {
      acc[name] = {
        totalHours: data.totalHours,
        adjustedHours: adjustedHours[name] || data.totalHours
      };
      return acc;
    }, {} as Record<string, { totalHours: number; adjustedHours: number }>);

    generateCombinedInvoice(doc, {
      selectedMonth,
      clientInfo,
      payableTo,
      selectedProjects,
      projectTotals,
      adjustedAmounts,
      projectsSummary,
      workerTotals,
      workerRates,
      showActivities,
      showAmounts,
      showTeamSummary
    });
    
    doc.save(`combined-invoice-${format(parse(selectedMonth, 'yyyy-MM', new Date()), 'yyyy-MM')}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Invoice Generator</h1>
        <div className="flex items-center space-x-4">
          <Link
            to="/toptal-converter"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FileText className="h-4 w-4 mr-2" />
            Toptal Converter
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Invoice For</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              value={clientInfo.name}
              onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={clientInfo.company}
              onChange={(e) => setClientInfo({ ...clientInfo, company: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter company name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={clientInfo.location}
              onChange={(e) => setClientInfo({ ...clientInfo, location: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter location"
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Payable To</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={payableTo.name}
              onChange={(e) => setPayableTo({ ...payableTo, name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
            <input
              type="text"
              value={payableTo.agency}
              onChange={(e) => setPayableTo({ ...payableTo, agency: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter agency"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={payableTo.location}
              onChange={(e) => setPayableTo({ ...payableTo, location: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter location"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">PDF Output Controls</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowActivities(!showActivities)}
            className={`flex items-center px-4 py-2 rounded-md ${
              showActivities 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {showActivities ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showActivities ? 'Hide Activities' : 'Show Activities'}
          </button>
          <button
            onClick={() => setShowAmounts(!showAmounts)}
            className={`flex items-center px-4 py-2 rounded-md ${
              showAmounts 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {showAmounts ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showAmounts ? 'Hide Amounts & Rates' : 'Show Amounts & Rates'}
          </button>
          <button
            onClick={() => setShowTeamSummary(!showTeamSummary)}
            className={`flex items-center px-4 py-2 rounded-md ${
              showTeamSummary 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {showTeamSummary ? <Users className="h-4 w-4 mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            {showTeamSummary ? 'Hide Team Summary' : 'Show Team Summary'}
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload CSV Files
        </label>
        <div className="flex flex-col space-y-2">
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              multiple
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
          <p className="text-sm text-gray-500">
            Worker rates will be automatically populated when you upload CSV files
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Team Member Rates</h3>
            <p className="text-sm text-gray-500">Rates are auto-populated from CSV data</p>
          </div>
          <button
            onClick={() => setWorkerRates([...workerRates, { name: '', rate: 0 }])}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Team Member
          </button>
        </div>
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {workerRates.map((rate, index) => (
            <div 
              key={index} 
              className={`flex items-center space-x-4 p-4 ${
                index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              <select
                value={rate.name}
                onChange={(e) => {
                  const newRates = [...workerRates];
                  newRates[index].name = e.target.value;
                  setWorkerRates(newRates);
                }}
                className="flex-grow rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select a team member...</option>
                {uniqueWorkers.map(worker => (
                  <option key={worker} value={worker}>{worker}</option>
                ))}
              </select>
              <div className="relative rounded-md shadow-sm w-32">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate.rate || ''}
                  onChange={(e) => {
                    const newRates = [...workerRates];
                    newRates[index].rate = parseFloat(e.target.value) || 0;
                    setWorkerRates(newRates);
                  }}
                  className="block w-full pl-7 pr-3 py-2 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
              {workerRates.length > 1 && (
                <button
                  onClick={() => setWorkerRates(workerRates.filter((_, i) => i !== index))}
                  className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {projects.length > 0 && (
        <div className="mb-6">
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Projects (Hold Ctrl/Cmd to select multiple)
            </label>
          </div>
          <select
            multiple
            value={selectedProjects}
            onChange={handleProjectSelection}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 min-h-[120px]"
          >
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
      )}
      
      {selectedProjects.length > 0 && (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Projects Summary</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
                    <span>Project Name</span>
                    <span>Hours</span>
                  </div>
                  {selectedProjects.map(project => {
                    const projectData = projectTotals[project];
                    return (
                      <div key={`hours-${project}`} className="px-4 py-2 flex justify-between items-center border-b border-gray-200">
                        <span>{project}</span>
                        <span>{projectData.totalHours.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center font-medium">
                    <span>Total Hours</span>
                    <span className="text-red-600">{projectsSummary.totalHours.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <div className="bg-blue-600 text-white px-4 py-2 flex justify-between items-center">
                    <span>Project Name</span>
                    <span>Amount</span>
                  </div>
                  {selectedProjects.map(project => {
                    const projectData = projectTotals[project];
                    const adjustedAmount = adjustedAmounts[project] || 0;
                    const finalAmount = projectData.totalAmount - adjustedAmount;
                    return (
                      <div key={`amount-${project}`} className="px-4 py-2 flex justify-between items-center border-b border-gray-200">
                        <span>{project}</span>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>${finalAmount.toFixed(2)}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={adjustedAmounts[project] || ''}
                            onChange={(e) => handleAdjustedAmountChange(project, e.target.value)}
                            className="w-24 text-sm rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Adjustment"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center font-medium">
                    <span>Total Payable</span>
                    <span className="text-green-600">${projectsSummary.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Team Members Summary</h2>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(combinedWorkerTotals).map(([name, data]) => {
                  const workerRate = workerRates.find(w => w.name === name)?.rate || 0;
                  const adjustedHour = adjustedHours[name] || data.totalHours;
                  const adjustedAmount = adjustedHour * workerRate;
                  const difference = adjustedAmount - data.totalAmount;

                  return (
                    <div key={name} className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <h3 className="font-medium text-gray-900 border-b pb-2">{name}</h3>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Rate:</span>
                          <span className="font-medium">${workerRate}/hr</span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Working Hours:</span>
                          <span className="font-medium text-blue-600">{data.totalHours.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Original Amount:</span>
                          <span className="font-medium">${data.totalAmount.toFixed(2)}</span>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="block text-sm text-gray-600">Adjustment Hours:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={adjustedHours[name] || ''}
                            onChange={(e) => handleAdjustedHoursChange(name, e.target.value)}
                            className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder={data.totalHours.toFixed(2)}
                          />
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Adjusted Hours:</span>
                          <span className="font-medium text-green-600">{adjustedHour.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Adjusted Amount:</span>
                          <span className="font-medium text-blue-600">${adjustedAmount.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm font-medium pt-2 border-t">
                          <span className="text-gray-600">Difference:</span>
                          <span className={difference >= 0 ? "text-green-600" : "text-red-600"}>
                            {difference >= 0 ? "+" : "-"}${Math.abs(difference).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-gray-600">Total Team Members:</span>
                    <span className="ml-2 font-medium">{Object.keys(combinedWorkerTotals).length}</span>
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-gray-600 mr-4">Total Adjustment Difference:</span>
                    <span className={totalDifference >= 0 ? "text-green-600" : "text-red-600"}>
                      {totalDifference >= 0 ? "+" : "-"}${Math.abs(totalDifference).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={generateCombinedInvoiceHandler}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Generate Combined Invoice
            </button>
            {selectedProjects.map(project => (
              <button
                key={project}
                onClick={() => generateInvoice(project)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                {project} Invoice
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default InvoiceGenerator;