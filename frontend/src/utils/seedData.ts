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

export const initialUsers: UserProfile[] = [];
export const initialActiveSession: QRSession | null = null;

export const generateSeedAttendanceRecords = (): AttendanceRecord[] => {
  const branches = [
    { code: 'CSE', name: 'Computer Science & Engineering', targetRate: 0.94, prefix: '22SBIT05' },
    { code: 'AIML', name: 'Artificial Intelligence & ML', targetRate: 0.92, prefix: '22SBIT66' },
    { code: 'ECE', name: 'Electronics & Communication', targetRate: 0.89, prefix: '22SBIT04' },
    { code: 'IT', name: 'Information Technology', targetRate: 0.86, prefix: '22SBIT12' },
    { code: 'EEE', name: 'Electrical & Electronics', targetRate: 0.84, prefix: '22SBIT02' },
    { code: 'CIVIL', name: 'Civil Engineering', targetRate: 0.81, prefix: '22SBIT01' },
    { code: 'MECH', name: 'Mechanical Engineering', targetRate: 0.78, prefix: '22SBIT03' }
  ];

  const studentPool: Record<string, string[]> = {
    CSE: [
      "K. Sai Praneeth", "V. Ananya", "M. Rahul Kumar", "P. Sneha Reddy", "T. Akhil Varma",
      "S. Harshitha", "B. Tarun Reddy", "N. Divya", "D. Rohit", "K. Bhavana"
    ],
    AIML: [
      "A. Sri Kruthika", "M. Muneeb Bhai", "P. Varun Teja", "K. Jahnavi", "S. Niharika",
      "R. Chetan Kumar", "V. Sahithi", "T. Pranav", "G. Likhitha", "B. Surya Prakash"
    ],
    ECE: [
      "R. Vikram", "G. Meghana", "A. Karthik", "P. Pooja", "K. Srikanth",
      "V. Lavanya", "J. Mahesh", "T. Swathi", "M. Sandeep", "S. Anusha"
    ],
    IT: [
      "D. Srinidhi", "K. Hemanth", "V. Tejaswini", "M. Vamsi Krishna", "P. Chandana",
      "S. Abhinav", "R. Manasa", "G. Sravan", "T. Ruchitha", "N. Prashanth"
    ],
    EEE: [
      "B. Venkatesh", "K. Mounika", "P. Suresh", "R. Deepika", "V. Naveen",
      "S. Keerthi", "N. Harish", "T. Pavani", "G. Rakesh", "A. Sushma"
    ],
    CIVIL: [
      "S. Bhanu Prasad", "K. Jyothi", "R. Shiva Kumar", "P. Sunitha", "M. Jagadeesh",
      "V. Ramya", "T. Goutham", "G. Shirisha", "A. Manoj", "B. Sandhya"
    ],
    MECH: [
      "P. Rakesh Kumar", "M. Avinash", "K. Praveen", "V. Sai Teja", "S. Manikanta",
      "G. Vinay", "T. Yashwanth", "B. Ajay", "N. Kalyan", "D. Charan"
    ]
  };

  const sessionsPerBranch: Record<string, string[]> = {
    CSE: ["Machine Learning & Edge AI", "Distributed Cloud Systems", "Algorithm Engineering"],
    AIML: ["Deep Neural Networks", "Computer Vision Systems", "Natural Language Processing"],
    ECE: ["VLSI Design & Architecture", "Digital Signal Processing", "Microcontrollers & IoT"],
    IT: ["Full Stack Web Architectures", "Cyber Security & Cryptography", "DevOps & Cloud"],
    EEE: ["Power Systems & Smart Grids", "Control Systems Engineering", "Renewable Energy Tech"],
    CIVIL: ["Structural Analysis & Design", "Geotechnical Engineering", "Environmental Engineering"],
    MECH: ["Thermodynamics & Heat Transfer", "Robotics & Automation", "Fluid Mechanics & Turbo"]
  };

  const records: AttendanceRecord[] = [];
  const now = new Date();

  // Generate records across past 21 days (weekdays)
  let dayOffset = 0;
  let recordCounter = 1;

  for (let i = 0; i < 21; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Skip Sunday (0)
    if (d.getDay() === 0) continue;

    branches.forEach(branch => {
      const students = studentPool[branch.code] || [];
      const sessionTitles = sessionsPerBranch[branch.code] || ["Campus Technical Lecture"];
      const sessionTitle = sessionTitles[i % sessionTitles.length];
      const sessionId = `ses_${branch.code.toLowerCase()}_d${i}`;

      students.forEach((studentName, sIdx) => {
        const rand = (Math.sin(i * 100 + sIdx * 37 + branch.code.charCodeAt(0)) + 1) / 2; // deterministic pseudo-random [0, 1]
        
        let status: "present" | "late" | "absent" = "present";
        if (rand > branch.targetRate) {
          status = rand > branch.targetRate + 0.08 ? "absent" : "late";
        }

        const markTime = new Date(d);
        markTime.setHours(9, 15 + Math.floor(rand * 30), Math.floor(rand * 50));

        const methods: Array<"face_recognition" | "qr_gps" | "biometric_fallback" | "manual"> = [
          "face_recognition", "face_recognition", "face_recognition", "qr_gps", "biometric_fallback"
        ];
        const method = methods[Math.floor(rand * methods.length)];

        records.push({
          recordId: `sbit_rec_${recordCounter++}`,
          sessionId: sessionId,
          sessionTitle: `${branch.code} - ${sessionTitle}`,
          studentId: `sbit_std_${branch.code.toLowerCase()}_${sIdx + 1}`,
          studentName: studentName,
          hallTicketNo: `${branch.prefix}${String(sIdx + 1).padStart(2, '0')}`,
          branch: branch.code,
          section: sIdx < 5 ? "A" : "B",
          year: 3,
          semester: "2",
          markedAt: markTime.toISOString(),
          status: status,
          verificationMethod: method,
          faceVerified: method === "face_recognition",
          faceMatchConfidence: method === "face_recognition" ? Math.round(92 + rand * 7) : undefined,
          faceDistance: method === "face_recognition" ? Number((0.28 + rand * 0.12).toFixed(3)) : undefined,
          blinkVerified: method === "face_recognition",
          biometricVerified: method === "biometric_fallback",
          gpsDistanceMeters: Math.round(8 + rand * 32),
          studentLat: 17.2472 + (rand - 0.5) * 0.001,
          studentLng: 80.1514 + (rand - 0.5) * 0.001,
          markedBy: "SBIT Smart Attendance Engine"
        });
      });
    });
  }

  return records;
};

export const initialAttendanceRecords: AttendanceRecord[] = generateSeedAttendanceRecords();
export const initialAuditLogs: AuditLog[] = [];


