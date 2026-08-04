export type UserRole = 'admin' | 'faculty' | 'student';

export type StudentStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  college: string;
  designation?: string; // Admin / Faculty
  department?: string;  // Faculty
  assignedBranch?: string; // Faculty assignment
  assignedSections?: string[]; // Faculty assigned sections e.g. ["CSE-A", "CSE-B"]
  hallTicketNo?: string; // Student
  branch?: string;       // Student e.g. "CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "DS"
  year?: string;         // Student e.g. "I", "II", "III", "IV"
  semester?: string;     // Student e.g. "1", "2"
  section?: string;      // Student e.g. "A", "B", "C", "D"
  status: StudentStatus; // For student approval workflow
  createdAt: string;
  updatedAt?: string;

  // Face Recognition AI Fields
  faceDescriptor?: number[]; // 128-float facial embedding
  faceEnrolledAt?: string;
  faceEnrollmentStatus?: 'pending' | 'enrolled';

  // Trusted Device Fingerprint Fields
  trustedDeviceId?: string;
  trustedDeviceName?: string;
  trustedDeviceRegisteredAt?: string;
}

export interface GeofenceConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
  address?: string;
  lastUpdated: string;
}
