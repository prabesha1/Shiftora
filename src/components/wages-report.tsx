import { Calendar, Download, Printer } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatLongDate, toISODate } from '../utils/time';
import { api } from '../api/client';
import { useEffect, useState } from 'react';

type Props = {
  onNavigate: (page: string) => void;
  user: { token: string };
};

export function WagesReport({ onNavigate, user }: Props) {
  const reportDate = new Date();
  const reportDateLabel = formatLongDate(reportDate);
  const reportDateISO = toISODate(reportDate);

  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [totalWages, setTotalWages] = useState(0);
  const [totalTips, setTotalTips] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const report = await api.getDailyReport(reportDateISO, user.token);
        setEmployeeData(report.employees || []);
        setTotalWages(report.totalWages || 0);
        setTotalTips(report.totalTips || 0);
      } catch {
        // fallback: leave empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reportDateISO, user.token]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Shiftora', 14, 20);
    
    doc.setFontSize(16);
    doc.text('Daily Wages & Tips Report', 14, 35);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(reportDateLabel, 14, 43);
    
    // Add table
    autoTable(doc, {
      startY: 50,
      head: [['Employee', 'Role', 'Hours', 'Rate', 'Wages', 'Tips']],
      body: employeeData.map(emp => [
        emp.name,
        emp.role,
        `${emp.hours}h`,
        `$${emp.rate}/hr`,
        `$${emp.wages}`,
        `$${emp.tips}`
      ]),
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', textColor: [34, 197, 94] }
      }
    });
    
    // Add totals
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Wages: $${totalWages.toLocaleString()}`, 14, finalY + 15);
    doc.text(`Total Tips: $${totalTips.toLocaleString()}`, 14, finalY + 25);
    
    // Add footer note
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('This report includes all shifts completed on the selected date.', 14, finalY + 40);
    doc.text('Tips are calculated based on pooled amounts distributed among staff.', 14, finalY + 46);
    
    // Save the PDF
    doc.save(`wages-tips-report-${reportDateISO}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl tracking-tight">
                <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
              </span>
            </div>
            <Badge variant="secondary" className="rounded-full">Report</Badge>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => onNavigate('manager')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Dashboard
            </button>
            <button className="text-gray-900">Wages & Tips</button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white">
              M
            </div>
            <Button 
              variant="ghost" 
              onClick={() => onNavigate('landing')}
              className="hidden sm:inline-flex"
            >
              Log out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl">Daily wages & tips report</h1>
          <p className="text-gray-600">
            Complete breakdown of hours worked, wages earned, and tips collected for the selected date.
          </p>
        </div>

        {/* Report Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Calendar className="w-5 h-5 text-gray-400" />
                <Input 
                  type="date" 
                  defaultValue={reportDateISO}
                  className="rounded-xl h-10 border-gray-200"
                />
              </div>
              
              <Button className="rounded-full h-10 bg-[#2563EB] hover:bg-[#1d4ed8]">
                Update
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full h-10" onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" className="rounded-full h-10" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Hourly rate</TableHead>
                  <TableHead className="text-right">Wages</TableHead>
                  <TableHead className="text-right">Tips</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeData.map((employee, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full">
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{employee.hours}h</TableCell>
                    <TableCell className="text-right">${employee.rate}/hr</TableCell>
                    <TableCell className="text-right font-medium">${employee.wages}</TableCell>
                    <TableCell className="text-right font-medium text-[#22C55E]">
                      ${employee.tips}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-end gap-4">
              <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 min-w-[200px]">
                <div className="text-sm text-gray-600 mb-2">Total wages</div>
                <div className="text-3xl">${totalWages.toLocaleString()}</div>
              </div>

              <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 min-w-[200px]">
                <div className="text-sm text-gray-600 mb-2">Total tips</div>
                <div className="text-3xl text-[#22C55E]">${totalTips.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary info */}
        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <div>
              <div className="font-medium text-blue-900 mb-1">Report generated for {reportDateLabel}</div>
              <div className="text-sm text-blue-800">
                This report includes all shifts completed on the selected date. Tips are calculated based on pooled amounts distributed among staff.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
