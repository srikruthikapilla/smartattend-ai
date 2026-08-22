import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../types/attendance';

export function exportAttendanceToExcel(records: AttendanceRecord[], filenamePrefix = 'SBIT_Attendance_Report') {
  const data = records.map(rec => {
    const d = new Date(rec.markedAt);
    return {
      'Date': d.toLocaleDateString(),
      'Time': d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Student Name': rec.studentName,
      'Hall Ticket Number': rec.hallTicketNo,
      'Branch': rec.branch,
      'Section': rec.section,
      'Year': rec.year,
      'Semester': rec.semester || 'N/A',
      'Session Title': rec.sessionTitle || 'Campus Attendance Session',
      'Faculty': rec.facultyName || 'Faculty',
      'Attendance Status': rec.status.toUpperCase(),
      'Verification Method': rec.verificationMethod === 'face_recognition'
        ? 'Face AI + Blink'
        : rec.verificationMethod === 'biometric_fallback'
        ? 'Biometric Platform'
        : rec.verificationMethod === 'qr_gps'
        ? 'QR + GPS'
        : 'Manual Override',
      'GPS Distance (m)': rec.gpsDistanceMeters !== undefined ? rec.gpsDistanceMeters : 'N/A',
      'Manual Reason': rec.manualReason || 'N/A',
      'Marked By': rec.markedBy ? (typeof rec.markedBy === 'string' ? rec.markedBy : (rec.markedBy as any).name || 'System') : 'System'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Records');

  // Auto-fit column widths
  const max_widths = [
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 22 }, // Name
    { wch: 16 }, // HT No
    { wch: 10 }, // Branch
    { wch: 8 },  // Section
    { wch: 8 },  // Year
    { wch: 8 },  // Sem
    { wch: 22 }, // Session
    { wch: 18 }, // Faculty
    { wch: 16 }, // Status
    { wch: 20 }, // Method
    { wch: 16 }, // Distance
    { wch: 25 }, // Reason
    { wch: 20 }  // Marked By
  ];
  worksheet['!cols'] = max_widths;

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStr}.xlsx`);
}

export function exportAttendanceToCSV(records: AttendanceRecord[], filenamePrefix = 'SBIT_Attendance_Report') {
  const data = records.map(rec => {
    const d = new Date(rec.markedAt);
    return {
      'Date': d.toLocaleDateString(),
      'Time': d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Student Name': rec.studentName,
      'Hall Ticket Number': rec.hallTicketNo,
      'Branch': rec.branch,
      'Section': rec.section,
      'Year': rec.year,
      'Session Title': rec.sessionTitle || 'Campus Session',
      'Faculty': rec.facultyName || 'Faculty',
      'Attendance Status': rec.status.toUpperCase(),
      'Method': rec.verificationMethod
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
