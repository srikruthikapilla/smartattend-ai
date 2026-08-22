export type UserRole = 'admin' | 'faculty' | 'student';

export type StudentStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/**
 * Validates whether a Hall Ticket number conforms to format: 2XXXXXXXXX
 * (10 alphanumeric characters starting with 2)
 */
export function isValidHallTicketNo(hallTicket: string): boolean {
  return /^2[0-9A-Za-z]{9}$/.test(hallTicket.trim());
}

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
  
  // Student Academic Fields (Format: 2XXXXXXXXX)
  hallTicketNo?: string; 
  branch?: string;       // "CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML"
  year?: string;         // "I", "II", "III", "IV"
  semester?: string;     // "1", "2"
  section?: string;      // "A", "B", "C", "D"
  status: StudentStatus; // For student approval workflow
  createdAt: string;
  updatedAt?: string;

  // Face Recognition AI 128-D Vector
  faceDescriptor?: number[]; // 128-float facial embedding
  faceEnrolledAt?: string;
  faceEnrollmentStatus?: 'pending' | 'enrolled';

  // WebAuthn / Passkey Biometric Fallback (Fingerprint / TouchID / Windows Hello)
  biometricCredentialId?: string;
  biometricPublicKey?: string;
  biometricEnrollmentStatus?: 'pending' | 'enrolled';
  biometricEnrolledAt?: string;

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

