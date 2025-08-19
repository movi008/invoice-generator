import { jsPDF } from 'jspdf';
import { format, parse } from 'date-fns';
import { ClientInfo, PayableTo } from './csvProcessor';

interface ProjectData {
  totalHours: number;
  totalAmount: number;
  activities: {
    activity: string;
    upwork_hours: number;
    workers: string;
  }[];
  workerSummaries: Record<string, { name: string; totalHours: number; totalAmount: number }>;
}

interface GenerateProjectPageOptions {
  doc: jsPDF;
  project: string;
  projectData: ProjectData;
  selectedMonth: string;
  workerRates: { name: string; rate: number; }[];
  adjustedAmounts: Record<string, number>;
  startY?: number;
  showActivities?: boolean;
  showAmounts?: boolean;
}

export function generateProjectPage({
  doc,
  project,
  projectData,
  selectedMonth,
  workerRates,
  adjustedAmounts,
  startY = 20,
  showActivities = true,
  showAmounts = true
}: GenerateProjectPageOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  doc.setFontSize(12);
  doc.setTextColor(33, 33, 33);
  doc.text(`Project: ${project}`, margin, startY);
  
  let y = startY + 8;
  
  if (showActivities) {
    const colWidths = showAmounts 
      ? [pageWidth - 120, 30, 30, 40]
      : [pageWidth - 50, 40];
    const headers = showAmounts 
      ? ['Activity', 'Hours', 'Rate', 'Amount']
      : ['Activity'];
    
    doc.setFillColor(51, 101, 138);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    let x = margin;
    headers.forEach((header, i) => {
      doc.text(header, x + 2, y + 5);
      x += colWidths[i];
    });

    if (!showAmounts) {
      const hoursColumnX = pageWidth - margin - 21; // Adjusted to match data alignment
      doc.text('Hours', hoursColumnX, y + 5, { align: 'right' });
    }
    
    y += 10;
    doc.setTextColor(33, 33, 33);
    
    projectData.activities.forEach((activity, index) => {
      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 20;
      }
    
      if (index % 2 === 0) {
        doc.setFillColor(247, 247, 247);
        doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
      }
    
      x = margin;
      doc.setFontSize(8);
    
      const maxWidth = colWidths[0] - 4;
      const splitText = doc.splitTextToSize(activity.activity, maxWidth);
      doc.text(splitText, x + 2, y + 5);
      x += colWidths[0];
    
      // Align hours properly when showAmounts is false
      if (!showAmounts) {
        doc.text(activity.upwork_hours.toFixed(2), pageWidth - margin - 30, y + 5);
      } else {
        doc.text(activity.upwork_hours.toFixed(2), x + 2, y + 5);
        x += colWidths[1];
    
        const rate = workerRates.find(w => w.name === activity.workers)?.rate || 0;
        doc.text(`$${rate.toFixed(2)}`, x + 2, y + 5);
    
        x += colWidths[2];
        const amount = activity.upwork_hours * rate;
        doc.text(`$${amount.toFixed(2)}`, x + 2, y + 5);
      }
    
      y += 8;
    });
  }
  
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  doc.text('Subtotal:', margin, y + 5);
  
  // Correctly align the total hours under the "Hours" column
  if(showAmounts) {
    const totalHoursX = pageWidth - margin - 60;
    doc.text(`${projectData.totalHours.toFixed(2)} hours`, totalHoursX, y + 5, { align: 'right' });
  }

  if(!showAmounts){
    const totalHoursX2 = pageWidth - margin - 12;
    doc.text(`${projectData.totalHours.toFixed(2)} hours`, totalHoursX2, y + 5, { align: 'right' });
  }
  
  if (showAmounts) {
    doc.text(`$${projectData.totalAmount.toFixed(2)}`, pageWidth - margin - 10, y + 5);

    const adjustedAmount = adjustedAmounts[project] || 0;
    if (adjustedAmount > 0) {
        y += 10;
        doc.setTextColor(255, 0, 0);
        doc.text('Adjustment / Discount:', margin, y + 6);
        doc.text(`-$${adjustedAmount.toFixed(2)}`, pageWidth - margin - 10, y + 6);

        doc.setFont("helvetica", "bold");
        y += 10;
        doc.setTextColor(33, 33, 33);
        doc.text('Grand Total:', margin, y + 6);
        doc.text(`$${(projectData.totalAmount - adjustedAmount).toFixed(2)}`, pageWidth - margin - 10, y + 6);
        doc.setFont("helvetica", "normal");
    }
  }
  
  return y + 15;
}

// Subtotal
// Adjustment / Discount
// Grand Total

interface GenerateInvoiceHeaderOptions {
  doc: jsPDF;
  selectedMonth: string;
  clientInfo: ClientInfo;
  payableTo: PayableTo;
}

export function generateInvoiceHeader({
  doc,
  selectedMonth,
  clientInfo,
  payableTo
}: GenerateInvoiceHeaderOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight(); // Get the page height
  const margin = 20;
  const selectedDate = parse(selectedMonth, 'yyyy-MM', new Date());

  doc.setFontSize(16);
  doc.setTextColor(33, 33, 33);

  const invoiceText = `Invoice ID: #${format(selectedDate, 'yyMMdd')}`;
  const monthText = format(selectedDate, 'yyyy-MM');
  const monthOfText = `Month of ${format(selectedDate, 'MMMM')}`;

  // Calculate centered positions horizontally
  const centerX = (pageWidth - doc.getTextWidth(invoiceText)) / 2;
  const centerXMonth = (pageWidth - doc.getTextWidth(monthText)) / 2;
  const centerXMonthOf = (pageWidth - doc.getTextWidth(monthOfText)) / 2;

  // Calculate vertical center position for the header
  const centerY = pageHeight / 4; // Adjust this value as needed

  // Draw text at centered positions
  doc.text(invoiceText, centerX, centerY);
  doc.text(monthText, centerXMonth, centerY + 10);
  doc.setTextColor(39, 174, 96);
  doc.text(monthOfText, centerXMonthOf, centerY + 20);

  doc.setTextColor(33, 33, 33);
  doc.setFontSize(10);

  // Reduced spacing between header items
  const headerSpacing = 8;
  let y = centerY + 40; // Start y position after the centered header

  // Invoice details section
  doc.text('Invoice for', margin, y);
  doc.text(`Name: ${clientInfo.name}`, margin, y + headerSpacing);
  doc.text(`Company: ${clientInfo.company}`, margin, y + headerSpacing * 2);
  doc.text(`Location: ${clientInfo.location}`, margin, y + headerSpacing * 3);
  // doc.text(`ID: ${format(selectedDate, 'yyMMdd')}`, margin, y + headerSpacing);

  // Payable to section, right-aligned
  doc.text('Payable to', pageWidth / 2 + margin, y);
  doc.text(`Name: ${payableTo.name}`, pageWidth / 2 + margin, y + headerSpacing);
  doc.text(`Agency: ${payableTo.agency}`, pageWidth / 2 + margin, y + headerSpacing * 2);
  doc.text(`Location: ${payableTo.location}`, pageWidth / 2 + margin, y + headerSpacing * 3);
  // doc.text(`Issue Date: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, pageWidth / 2 + margin, y + headerSpacing * 4);
}

interface GenerateTeamSummaryOptions {
  doc: jsPDF;
  workerTotals: Record<string, { totalHours: number; adjustedHours: number }>;
  startY?: number;
  showAmounts?: boolean;
}

export function generateTeamSummary({ 
  doc, 
  workerTotals, 
  startY = 20,
  showAmounts = true
}: GenerateTeamSummaryOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const rowHeight = 8; // Fixed row height
  
  doc.setFontSize(14);
  doc.setTextColor(33, 33, 33);
  doc.text('Team Members Summary', pageWidth / 2, startY - 30, { align: 'center' });

  let y = startY - 15; 
  const tableWidth = pageWidth - 2 * margin;
  
  doc.setFillColor(51, 101, 138);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  
  const colWidths = [tableWidth * 0.4, tableWidth * 0.3, tableWidth * 0.3];
  doc.text('Employee Name', margin + 5, y + 5);
  doc.text('Working Hours', margin + colWidths[0] + 5, y + 5);
  doc.text('Adjusted Hours', margin + colWidths[0] + colWidths[1] + 5, y + 5);

  y += rowHeight;
  doc.setTextColor(33, 33, 33);

  Object.entries(workerTotals).forEach(([name, data], index) => {
    // Alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(247, 247, 247);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, y, tableWidth, rowHeight, 'F');

    // Ensure single-line text to maintain row height consistency
    doc.text(name, margin + 5, y + 5);
    doc.text(data.totalHours.toFixed(2), margin + colWidths[0] + 5, y + 5);
    doc.text(data.adjustedHours.toFixed(2), margin + colWidths[0] + colWidths[1] + 5, y + 5);

    y += rowHeight; // Maintain consistent row height
  });

  // Total row
  y += 2; // Small gap before totals
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  
  const totalWorkingHours = Object.values(workerTotals).reduce((sum, data) => sum + data.totalHours, 0);
  const totalAdjustedHours = Object.values(workerTotals).reduce((sum, data) => sum + data.adjustedHours, 0);

  doc.text('Total Hours', margin + 5, y + 5);
  doc.setTextColor(255, 0, 0);
  doc.text(totalWorkingHours.toFixed(2), margin + colWidths[0] + 5, y + 5);
  doc.setTextColor(39, 174, 96);
  doc.text(totalAdjustedHours.toFixed(2), margin + colWidths[0] + colWidths[1] + 5, y + 5);

  return y + 20; // Return position with padding for next section
}

interface GenerateProjectsSummaryOptions {
  doc: jsPDF;
  selectedProjects: string[];
  projectTotals: Record<string, ProjectData>;
  adjustedAmounts: Record<string, number>;
  projectsSummary: { totalHours: number; totalAmount: number };
  startY?: number;
  showAmounts?: boolean;
}

export function generateProjectsSummary({
  doc,
  selectedProjects,
  projectTotals,
  adjustedAmounts,
  projectsSummary,
  startY = 20,
  showAmounts = true
}: GenerateProjectsSummaryOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Add decorative header
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, startY - 5, pageWidth - 2 * margin, 10, 'F');
  
  // Add title with enhanced styling
  doc.setFontSize(14);
  doc.setTextColor(51, 101, 138, 0.1);
  doc.text('Projects Summary', pageWidth / 2, startY + 5, { align: 'center' });

  let y = startY + 20; // Adjusted spacing after enhanced header
  const tableWidth = showAmounts ? (pageWidth - 2 * margin - 10) / 2 : (pageWidth - 2 * margin - 10); // Slightly adjusted for better spacing
  const colPadding = 8;

  // Enhanced table headers
  const headerHeight = 8;
  
  // Hours Summary Table Header
  doc.setFillColor(51, 101, 138);
  doc.rect(margin, y, tableWidth, headerHeight, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Project Name', margin + colPadding, y + 5);
  doc.text('Hours', margin + tableWidth - 35, y + 5);

  if (showAmounts) {
    doc.setFillColor(51, 101, 138);
    doc.rect(margin + tableWidth + 10, y, tableWidth, headerHeight, 'F');
    doc.text('Project Name', margin + tableWidth + 10 + colPadding, y + 5);
    doc.text('Amount', pageWidth - margin - 35, y + 5);
  }

  y += headerHeight;
  doc.setTextColor(33, 33, 33);

  selectedProjects.forEach((project, index) => {
    const projectData = projectTotals[project];
    const adjustedAmount = adjustedAmounts[project] || 0;
    const finalAmount = projectData.totalAmount - adjustedAmount;
    const rowHeight = 8;

    if (index % 2 === 0) {
      doc.setFillColor(247, 247, 247);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    
    doc.rect(margin, y, tableWidth, rowHeight, 'F');
    if (showAmounts) {
      doc.rect(margin + tableWidth + 10, y, tableWidth, rowHeight, 'F');
    }

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, margin + tableWidth, y);
    if (showAmounts) {
      doc.line(margin + tableWidth + 10, y, pageWidth - margin, y);
    }

    doc.setFontSize(10);
    doc.text(project, margin + colPadding, y + 5);
    doc.text(projectData.totalHours.toFixed(2), margin + tableWidth - 35, y + 5);
    
    if (showAmounts) {
      doc.text(project, margin + tableWidth + 10 + colPadding, y + 5);
      doc.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin - 35, y + 5);
    }

    y += rowHeight;
  });

  const totalRowHeight = 8;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, totalRowHeight, 'F');
  if (showAmounts) {
    doc.rect(margin + tableWidth + 10, y, tableWidth, totalRowHeight, 'F');
  }

  doc.setFontSize(10);
  doc.text('Total Hours', margin + colPadding, y + 5);
  doc.text(projectsSummary.totalHours.toFixed(2), margin + tableWidth - 35, y + 5);

  if (showAmounts) {
    doc.setTextColor(0, 0, 0);
    doc.text('Total Payable', margin + tableWidth + 10 + colPadding, y + 5);
    doc.setTextColor(39, 174, 96);
    doc.text(`$${projectsSummary.totalAmount.toFixed(2)}`, pageWidth - margin - 35, y + 5);
  }

  return y + totalRowHeight + 20;
}

export function generateCombinedInvoice(doc: jsPDF, {
  selectedMonth,
  clientInfo,
  payableTo,
  selectedProjects,
  projectTotals,
  adjustedAmounts,
  projectsSummary,
  workerTotals,
  workerRates,
  showActivities = true,
  showAmounts = true,
  showTeamSummary = true
}) {
  generateInvoiceHeader({
    doc,
    selectedMonth,
    clientInfo,
    payableTo
  });

  doc.addPage();

  let y = generateProjectsSummary({
    doc,
    selectedProjects,
    projectTotals,
    adjustedAmounts,
    projectsSummary,
    startY: 20,
    showAmounts
  });

  y += 30;

  if (showTeamSummary) {
    generateTeamSummary({
      doc,
      workerTotals,
      startY: y,
      showAmounts
    });
  }

  if (showActivities) {
    selectedProjects.forEach(project => {
      doc.addPage();
      generateProjectPage({
        doc,
        project,
        projectData: projectTotals[project],
        selectedMonth,
        workerRates,
        adjustedAmounts,
        showActivities,
        showAmounts
      });
    });
  }
}