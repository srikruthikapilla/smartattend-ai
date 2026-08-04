import { UserProfile, GeofenceConfig } from '../types/auth';
import { QRSession } from '../types/session';
import { AttendanceRecord, AuditLog } from '../types/attendance';

export const SBIT_COLLEGE_NAME = "Swarna Bharathi Institute of Science and Technology (SBIT)";

export const initialGeofence: GeofenceConfig = {
  latitude: 17.2472, // SBIT Khammam, Telangana Coordinates
  longitude: 80.1514,
  radiusMeters: 500, // 500m campus boundary
  enabled: true,
  address: "SBIT Campus, Pakabanda Street, Khammam, Telangana 507002",
  lastUpdated: new Date().toISOString()
};

export const initialUsers: UserProfile[] = [
  {
    uid: "admin_101",
    email: "admin@sbit.ac.in",
    name: "Dr. K. V. S. Ramarao",
    phone: "+91 98480 12345",
    role: "admin",
    college: SBIT_COLLEGE_NAME,
    designation: "Director of Academics & IT",
    status: "approved",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    uid: "faculty_201",
    email: "p.srinivas@sbit.ac.in",
    name: "Prof. P. Srinivas",
    phone: "+91 98481 23456",
    role: "faculty",
    college: SBIT_COLLEGE_NAME,
    designation: "Associate Professor",
    department: "Computer Science & Engineering",
    assignedBranch: "CSE",
    assignedSections: ["CSE-A", "CSE-B", "AIML-A"],
    status: "approved",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    uid: "faculty_202",
    email: "m.radhika@sbit.ac.in",
    name: "Dr. M. Radhika",
    phone: "+91 98482 34567",
    role: "faculty",
    college: SBIT_COLLEGE_NAME,
    designation: "HOD - ECE",
    department: "Electronics & Communication Engg",
    assignedBranch: "ECE",
    assignedSections: ["ECE-A", "ECE-B"],
    status: "approved",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    uid: "student_301",
    email: "rahul.21sbit@gmail.com",
    name: "Rahul Verma",
    phone: "+91 91234 56789",
    role: "student",
    college: SBIT_COLLEGE_NAME,
    hallTicketNo: "21SBIT0501",
    branch: "CSE",
    year: "III",
    semester: "1",
    section: "A",
    status: "approved",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    uid: "student_302",
    email: "ananya.21sbit@gmail.com",
    name: "Ananya Reddy",
    phone: "+91 91234 56790",
    role: "student",
    college: SBIT_COLLEGE_NAME,
    hallTicketNo: "21SBIT0502",
    branch: "CSE",
    year: "III",
    semester: "1",
    section: "A",
    status: "approved",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    uid: "student_303",
    email: "saikiran.21sbit@gmail.com",
    name: "Sai Kiran",
    phone: "+91 91234 56791",
    role: "student",
    college: SBIT_COLLEGE_NAME,
    hallTicketNo: "21SBIT0503",
    branch: "CSE",
    year: "III",
    semester: "1",
    section: "A",
    status: "approved",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    uid: "student_304",
    email: "priya.22sbit@gmail.com",
    name: "Priya Sharma",
    phone: "+91 91234 56792",
    role: "student",
    college: SBIT_COLLEGE_NAME,
    hallTicketNo: "22SBIT0401",
    branch: "ECE",
    year: "II",
    semester: "1",
    section: "A",
    status: "pending", // PENDING APPROVAL TEST STUDENT
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    uid: "student_305",
    email: "vikram.22sbit@gmail.com",
    name: "Vikram Kumar",
    phone: "+91 91234 56793",
    role: "student",
    college: SBIT_COLLEGE_NAME,
    hallTicketNo: "22SBIT0402",
    branch: "ECE",
    year: "II",
    semester: "1",
    section: "B",
    status: "pending", // PENDING APPROVAL TEST STUDENT
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
  }
];

export const initialActiveSession: QRSession = {
  sessionId: "sess_dsa_101",
  subject: "Data Structures & Algorithms",
  branch: "CSE",
  year: "III",
  semester: "1",
  section: "A",
  facultyId: "faculty_201",
  facultyName: "Prof. P. Srinivas",
  durationMins: 45,
  qrValiditySecs: 30,
  status: "active",
  startTimestamp: Date.now() - 5 * 60 * 1000, // Started 5 mins ago
  endTimestamp: Date.now() + 40 * 60 * 1000,
  currentRotationToken: "",
  currentRotationNumber: 10,
  lastRotatedAt: Date.now(),
  geofence: {
    lat: 17.2472,
    lng: 80.1514,
    radiusMeters: 500,
    enabled: true
  },
  totalPresent: 2,
  totalLate: 1,
  totalAbsent: 0,
  createdAt: new Date().toISOString()
};

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    recordId: "att_1",
    sessionId: "sess_dsa_101",
    studentId: "student_301",
    studentName: "Rahul Verma",
    hallTicketNo: "21SBIT0501",
    branch: "CSE",
    section: "A",
    year: "III",
    semester: "1",
    subject: "Data Structures & Algorithms",
    facultyName: "Prof. P. Srinivas",
    status: "present",
    verificationMethod: "qr_gps",
    markedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    gpsDistanceMeters: 45,
    studentLat: 17.2474,
    studentLng: 80.1516
  },
  {
    recordId: "att_2",
    sessionId: "sess_dsa_101",
    studentId: "student_302",
    studentName: "Ananya Reddy",
    hallTicketNo: "21SBIT0502",
    branch: "CSE",
    section: "A",
    year: "III",
    semester: "1",
    subject: "Data Structures & Algorithms",
    facultyName: "Prof. P. Srinivas",
    status: "present",
    verificationMethod: "qr_gps",
    markedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    gpsDistanceMeters: 82,
    studentLat: 17.2471,
    studentLng: 80.1511
  },
  {
    recordId: "att_3",
    sessionId: "sess_dsa_101",
    studentId: "student_303",
    studentName: "Sai Kiran",
    hallTicketNo: "21SBIT0503",
    branch: "CSE",
    section: "A",
    year: "III",
    semester: "1",
    subject: "Data Structures & Algorithms",
    facultyName: "Prof. P. Srinivas",
    status: "late",
    verificationMethod: "manual",
    markedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    manualReason: "Camera hardware failure on mobile device",
    markedBy: {
      uid: "faculty_201",
      name: "Prof. P. Srinivas",
      role: "faculty"
    }
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    logId: "log_101",
    action: "SESSION_CREATED",
    performedBy: "Prof. P. Srinivas",
    performerRole: "faculty",
    details: "Started attendance session for DSA (CSE-III-A)",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    logId: "log_102",
    action: "MANUAL_ATTENDANCE_OVERRIDE",
    performedBy: "Prof. P. Srinivas",
    performerRole: "faculty",
    details: "Manually marked Sai Kiran (21SBIT0503) as Late due to camera issues",
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString()
  }
];
