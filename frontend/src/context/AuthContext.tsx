import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import {
  UserProfile,
  StudentStatus,
  isValidHallTicketNo,
} from "../types/auth";

import {
  initialUsers,
  SBIT_COLLEGE_NAME,
} from "../utils/seedData";

import {
  sendRegistrationStatusEmail,
  sendTrustedDeviceResetEmail,
} from "../utils/emailNotifier";


interface AuthContextType {
  currentUser: UserProfile | null;
  users: UserProfile[];

  login(
    email: string,
    password?: string,
    role?: string
  ): Promise<boolean>;

  logout(): void;

  requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; message: string }>;

  resetPasswordWithCode(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }>;

  registerAdmin(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile>;

  registerFaculty(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile>;

  registerStudent(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile>;

  insertStudent(
    data: {
      name: string;
      email: string;
      hallTicketNo: string;
      branch: string;
      section: string;
      year: number;
      semester?: number;
      phone?: string;
      status?: StudentStatus;
    }
  ): Promise<UserProfile>;

  bulkInsertStudents(
    students: Array<{
      name: string;
      email: string;
      hallTicketNo: string;
      branch: string;
      section: string;
      year: number;
      semester?: number;
      phone?: string;
      status?: StudentStatus;
    }>
  ): Promise<{ addedCount: number; duplicateCount: number; errors: string[] }>;

  bulkInsertFaculty(
    facultyList: Array<{
      name: string;
      email: string;
      password?: string;
      phone?: string;
      department?: string;
      designation?: string;
      assignedBranch?: string;
      assignedSections?: string[];
      status?: 'approved' | 'pending';
    }>
  ): Promise<{ addedCount: number; duplicateCount: number; errors: string[] }>;

  updateStudentStatus(
    uid: string,
    status: StudentStatus
  ): void;

  updateUser(
    uid: string,
    updates: Partial<UserProfile>
  ): void;

  deleteUser(uid: string): Promise<void>;

  enrollStudentFace(
    uid: string,
    descriptor: number[]
  ): Promise<boolean>;

  revokeStudentFace(
    uid: string
  ): Promise<boolean>;

  enrollStudentBiometrics(
    uid: string,
    credentialId: string,
    publicKey?: string
  ): Promise<void>;

  registerTrustedDevice(
    uid: string,
    fingerprint: string,
    deviceName: string
  ): void;

  resetTrustedDevice(uid: string): void;

  switchUser(uid: string): void;

  refreshUsers(): Promise<void>;

  pendingStudents: UserProfile[];

  approvedStudents: UserProfile[];
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {

  const [users, setUsers] = useState<UserProfile[]>([]);

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(() => {
      try {
        const cached = localStorage.getItem('sbit_user');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    });

  const getAuthHeaders = (): Record<string, string> => {
    return { 'Content-Type': 'application/json' };
  };

  // Restore session from backend on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            const u = data.user;
            const userProfile: UserProfile = {
              uid: u.id || u.uid,
              email: u.email,
              name: u.name,
              phone: u.phone || undefined,
              role: (u.role || 'student') as any,
              college: u.college || SBIT_COLLEGE_NAME,
              department: u.department || undefined,
              designation: u.designation || undefined,
              assignedBranch: u.assigned_branch || undefined,
              assignedSections: u.assigned_sections || [],
              hallTicketNo: u.hall_ticket_no || undefined,
              branch: u.branch || undefined,
              section: u.section || undefined,
              year: u.year ? String(u.year) : undefined,
              semester: u.semester ? String(u.semester) : undefined,
              faceDescriptor: u.face_descriptor || undefined,
              faceEnrollmentStatus: u.face_enrollment_status || 'pending',
              status: u.status || 'approved',
              createdAt: u.created_at || u.createdAt || new Date().toISOString()
            };
            setCurrentUser(userProfile);
            localStorage.setItem('sbit_user', JSON.stringify(userProfile));
          }
        }
      } catch (e) {
        // Not authenticated
      }
    };
    restoreSession();
  }, []);

  // Synchronization with backend PostgreSQL users table
  const refreshUsers = async (): Promise<void> => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          const mapped: UserProfile[] = data.users.map((u: any) => ({
            uid: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone || undefined,
            role: (u.role || 'student') as any,
            college: u.college || SBIT_COLLEGE_NAME,
            department: u.department || undefined,
            designation: u.designation || undefined,
            assignedBranch: u.assigned_branch || undefined,
            assignedSections: u.assigned_sections || [],
            hallTicketNo: u.hall_ticket_no || undefined,
            branch: u.branch || undefined,
            section: u.section || undefined,
            year: u.year ? String(u.year) : undefined,
            semester: u.semester ? String(u.semester) : undefined,
            faceDescriptor: u.face_descriptor || undefined,
            faceEnrollmentStatus: u.face_enrollment_status || 'pending',
            status: u.status || 'approved',
            createdAt: u.created_at || new Date().toISOString()
          }));

          setUsers(mapped);
          localStorage.setItem("sbit_users", JSON.stringify(mapped));
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refreshUsers();
  }, [currentUser]);

  const login = async (
    email: string,
    password?: string,
    role?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: cleanEmail, password, role })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        const u = data.user;
        const backendUser: UserProfile = {
          uid: u.id || u.uid,
          email: u.email,
          name: u.name,
          phone: u.phone || undefined,
          role: (u.role || 'student') as any,
          college: u.college || SBIT_COLLEGE_NAME,
          department: u.department || undefined,
          designation: u.designation || undefined,
          assignedBranch: u.assigned_branch || undefined,
          assignedSections: u.assigned_sections || [],
          hallTicketNo: u.hall_ticket_no || undefined,
          branch: u.branch || undefined,
          section: u.section || undefined,
          year: u.year ? String(u.year) : undefined,
          semester: u.semester ? String(u.semester) : undefined,
          faceDescriptor: u.face_descriptor || undefined,
          faceEnrollmentStatus: u.face_enrollment_status || 'pending',
          status: u.status || 'approved',
          createdAt: u.created_at || u.createdAt || new Date().toISOString()
        };
        localStorage.setItem('sbit_user', JSON.stringify(backendUser));
        setUsers(prev => {
          const exists = prev.some(usr => usr.uid === backendUser.uid || usr.email === backendUser.email);
          return exists ? prev.map(usr => usr.email === backendUser.email ? backendUser : usr) : [backendUser, ...prev];
        });
        setCurrentUser(backendUser);
        return true;
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Authentication failed (${response.status})`);
    }

    throw new Error("Unable to authenticate. Please verify your credentials.");
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('Backend logout note:', err);
    }
    
    localStorage.removeItem('sbit_auth_token');
    localStorage.removeItem('sbit_user');
    setCurrentUser(null);
    setUsers([]);
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const response = await fetch('/api/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: cleanEmail })
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return {
        success: true,
        message: data.message || "Verification code sent to your email."
      };
    }

    throw new Error(data.detail || "Unable to reach authentication server. Please try again.");
  };

  const resetPasswordWithCode = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: cleanEmail,
        otp,
        new_password: newPassword
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "Failed to reset password.");
    }

    return {
      success: true,
      message: data.message || "Password successfully updated!"
    };
  };

  const registerAdmin = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    if (!password || password.trim().length < 4) {
      throw new Error("Password must be at least 4 characters long.");
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        name: data.name.trim(),
        phone: data.phone || null,
        role: 'admin',
        college: data.college || SBIT_COLLEGE_NAME,
        designation: data.designation || 'System Administrator',
        department: data.department || null,
        status: 'approved'
      })
    });

    if (res.ok) {
      const resData = await res.json();
      const serverUser = resData.user || {};
      const registeredUser: UserProfile = {
        ...data,
        uid: serverUser.id || crypto.randomUUID(),
        email: serverUser.email || cleanEmail,
        name: serverUser.name || data.name.trim(),
        role: 'admin',
        college: serverUser.college || data.college || SBIT_COLLEGE_NAME,
        designation: serverUser.designation || data.designation || 'System Administrator',
        status: 'approved',
        createdAt: serverUser.createdAt || new Date().toISOString()
      };
      await refreshUsers();
      return registeredUser;
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error (${res.status})`);
    }
  };

  const registerFaculty = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    if (!password || password.trim().length < 4) {
      throw new Error("Password must be at least 4 characters long.");
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        email: cleanEmail,
        password: password,
        name: data.name.trim(),
        phone: data.phone || null,
        role: 'faculty',
        college: data.college || SBIT_COLLEGE_NAME,
        designation: data.designation || 'Assistant Professor',
        department: data.department || 'Computer Science & Engineering',
        assigned_branch: data.assignedBranch || 'CSE',
        assigned_sections: data.assignedSections || ['A', 'B'],
        status: 'approved'
      })
    });

    if (res.ok) {
      const resData = await res.json();
      const serverUser = resData.user || {};
      const registeredUser: UserProfile = {
        ...data,
        uid: serverUser.id || crypto.randomUUID(),
        email: serverUser.email || cleanEmail,
        name: serverUser.name || data.name.trim(),
        role: 'faculty',
        college: serverUser.college || data.college || SBIT_COLLEGE_NAME,
        designation: serverUser.designation || data.designation || 'Assistant Professor',
        department: serverUser.department || data.department || 'Computer Science & Engineering',
        status: 'approved',
        createdAt: serverUser.createdAt || new Date().toISOString()
      };
      await refreshUsers();
      return registeredUser;
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error (${res.status})`);
    }
  };

  const registerStudent = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    const formattedHT = (data.hallTicketNo || '').trim().toUpperCase();

    let uid: string = crypto.randomUUID();

    const newStudent: UserProfile = {
      ...data,
      uid,
      email: cleanEmail,
      hallTicketNo: formattedHT,
      role: "student",
      college: SBIT_COLLEGE_NAME,
      status: "approved",
      createdAt: new Date().toISOString(),
      faceEnrollmentStatus: "pending",
      biometricEnrollmentStatus: "pending",
    };

    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: cleanEmail,
          name: data.name.trim(),
          hall_ticket_no: formattedHT,
          branch: data.branch || 'CSE',
          section: (data.section || 'A').toUpperCase(),
          year: String(data.year || 3),
          semester: String(data.semester || 1),
          phone: data.phone || null,
          role: 'student',
          college: SBIT_COLLEGE_NAME,
          status: 'approved'
        })
      });
    } catch (err) {
      console.warn("Backend register student notice:", err);
    }

    setUsers(prev => [newStudent, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)]);
    setCurrentUser(newStudent);
    return newStudent;
  };

  const insertStudent = async (
    data: {
      name: string;
      email: string;
      hallTicketNo: string;
      branch: string;
      section: string;
      year: number;
      semester?: number;
      phone?: string;
      status?: StudentStatus;
    }
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    const formattedHT = data.hallTicketNo.trim().toUpperCase();
    let uid = crypto.randomUUID();

    const newStudent: UserProfile = {
      uid,
      name: data.name.trim(),
      email: cleanEmail,
      hallTicketNo: formattedHT,
      branch: data.branch,
      section: data.section.toUpperCase(),
      year: String(data.year),
      semester: String(data.semester || 1),
      phone: data.phone || '',
      role: "student",
      college: SBIT_COLLEGE_NAME,
      status: data.status || "approved",
      createdAt: new Date().toISOString(),
      faceEnrollmentStatus: "pending",
      biometricEnrollmentStatus: "pending",
    };

    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: cleanEmail,
          name: data.name.trim(),
          hall_ticket_no: formattedHT,
          branch: data.branch,
          section: data.section.toUpperCase(),
          year: String(data.year),
          semester: String(data.semester || 1),
          phone: data.phone || null,
          role: 'student',
          college: SBIT_COLLEGE_NAME,
          status: data.status || 'approved'
        })
      });
    } catch (err) {
      console.warn("Backend insert student notice:", err);
    }

    setUsers(prev => [newStudent, ...prev]);
    return newStudent;
  };

  const bulkInsertStudents = async (
    students: Array<{
      name: string;
      email: string;
      hallTicketNo: string;
      branch: string;
      section: string;
      year: number;
      semester?: number;
      phone?: string;
      status?: StudentStatus;
    }>
  ): Promise<{ addedCount: number; duplicateCount: number; errors: string[] }> => {
    return { addedCount: 0, duplicateCount: 0, errors: [] };
  };

  const importStudentsFromExcel = async (
    parsedStudents: Array<{
      name: string;
      hallTicketNo: string;
      branch: string;
      section: string;
      year: number;
      semester?: number;
      email?: string;
      phone?: string;
      status?: 'approved' | 'pending';
    }>
  ): Promise<{
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> => {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    const newStudentsToAdd: UserProfile[] = [];

    parsedStudents.forEach((raw) => {
      const formattedHT = (raw.hallTicketNo || '').trim().toUpperCase();
      if (!formattedHT) {
        skipped++;
        return;
      }
      const cleanEmail = raw.email ? raw.email.trim().toLowerCase() : `${formattedHT.toLowerCase()}@sbit.ac.in`;

      newStudentsToAdd.push({
        uid: formattedHT,
        email: cleanEmail,
        name: raw.name.trim(),
        hallTicketNo: formattedHT,
        branch: raw.branch || 'CSE',
        section: (raw.section || 'A').toUpperCase(),
        year: String(raw.year || 3),
        semester: String(raw.semester || 1),
        phone: raw.phone || undefined,
        role: 'student',
        college: SBIT_COLLEGE_NAME,
        status: raw.status || 'approved',
        createdAt: new Date().toISOString(),
        faceEnrollmentStatus: 'pending',
        biometricEnrollmentStatus: 'pending'
      });
    });

    if (newStudentsToAdd.length > 0) {
      try {
        await fetch('/api/auth/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            students: newStudentsToAdd.map(s => ({
              email: s.email,
              name: s.name,
              hall_ticket_no: s.hallTicketNo,
              branch: s.branch,
              section: s.section,
              year: s.year,
              semester: s.semester,
              phone: s.phone,
              status: s.status
            }))
          })
        });
      } catch (err) {
        console.warn("Backend bulk insert notice:", err);
      }

      setUsers(prev => [...newStudentsToAdd, ...prev]);
    }

    return {
      added: newStudentsToAdd.length,
      updated: 0,
      skipped,
      errors
    };
  };

  const bulkInsertFaculty = async (
    facultyList: Array<{
      name: string;
      email: string;
      password?: string;
      phone?: string;
      department?: string;
      designation?: string;
      assignedBranch?: string;
      assignedSections?: string[];
      status?: 'approved' | 'pending';
    }>
  ): Promise<{ addedCount: number; duplicateCount: number; errors: string[] }> => {
    const errors: string[] = [];
    const newFacultyToAdd: UserProfile[] = [];
    const existingEmails = new Set(users.map(u => u.email?.toLowerCase()).filter(Boolean));
    let duplicateCount = 0;

    facultyList.forEach((f, idx) => {
      const rowNum = idx + 1;
      const name = f.name?.trim();
      const email = f.email?.trim().toLowerCase();

      if (!name || !email) {
        errors.push(`Row ${rowNum}: Name and Email are required.`);
        return;
      }

      if (existingEmails.has(email)) {
        duplicateCount++;
        return;
      }

      existingEmails.add(email);

      newFacultyToAdd.push({
        uid: crypto.randomUUID(),
        name: name,
        email: email,
        phone: f.phone || '',
        department: f.department || 'Computer Science & Engineering',
        designation: f.designation || 'Assistant Professor',
        assignedBranch: f.assignedBranch || 'CSE',
        assignedSections: f.assignedSections || ['A', 'B'],
        role: "faculty",
        college: SBIT_COLLEGE_NAME,
        status: f.status || "approved",
        createdAt: new Date().toISOString(),
      });
    });

    if (newFacultyToAdd.length > 0) {
      const res = await fetch('/api/auth/faculty/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          faculty: newFacultyToAdd.map(f => ({
            name: f.name,
            email: f.email,
            phone: f.phone || null,
            department: f.department,
            designation: f.designation,
            assigned_branch: f.assignedBranch,
            assigned_sections: f.assignedSections,
            status: f.status
          }))
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server error (${res.status})`);
      }

      await refreshUsers();
    }

    return {
      addedCount: newFacultyToAdd.length,
      duplicateCount,
      errors
    };
  };

  const updateStudentStatus = (
    uid: string,
    status: StudentStatus
  ) => {
    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              status,
              updatedAt: new Date().toISOString(),
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        status,
      });
    }
  };

  const updateUser = async (
    uid: string,
    updates: Partial<UserProfile>
  ) => {
    const res = await fetch(`/api/auth/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        name: updates.name,
        phone: updates.phone,
        role: updates.role,
        status: updates.status,
        designation: updates.designation,
        department: updates.department,
        assigned_branch: updates.assignedBranch,
        assigned_sections: updates.assignedSections,
        hall_ticket_no: updates.hallTicketNo,
        branch: updates.branch,
        section: updates.section,
        year: updates.year,
        semester: updates.semester,
        college: updates.college
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error (${res.status})`);
    }

    await refreshUsers();
  };

  const deleteUser = async (uid: string): Promise<void> => {
    const res = await fetch(`/api/auth/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || (res.status === 502 ? "Server gateway unreachable. Please retry in a few seconds." : `Server error (${res.status})`));
    }

    setUsers(prev => prev.filter(user => user.uid !== uid && user.email.toLowerCase() !== uid.toLowerCase()));

    if (currentUser && (currentUser.uid === uid || currentUser.email.toLowerCase() === uid.toLowerCase())) {
      logout();
    } else {
      await refreshUsers();
    }
  };

  const enrollStudentFace = async (
    uid: string,
    descriptor: number[]
  ): Promise<boolean> => {
    const enrolledAt = new Date().toISOString();
    const student = users.find(u => u.uid === uid) || (currentUser?.uid === uid ? currentUser : null);
    const hallTicketNo = student?.hallTicketNo;
    const failures: string[] = [];
    let persisted = false;



    // 2. FastAPI backend sync
    // Token is now in httpOnly cookie
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    if (hallTicketNo) {
      try {
        const resp = await fetch('/api/student/register-biometrics', {
          method: 'POST',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            hallTicketNo: hallTicketNo,
            name: student?.name || currentUser?.name || `Student (${hallTicketNo})`,
            branch: student?.branch || currentUser?.branch || 'CSE',
            section: student?.section || currentUser?.section || 'A',
            faceDescriptor: descriptor,
            biometricCredentialId: student?.biometricCredentialId || 'bio_auto_registered'
          })
        });
        if (resp.ok) {
          localStorage.setItem(`enrolled_${hallTicketNo}`, 'true');
          persisted = true;
        }
      } catch (err) {
        failures.push(`Backend register-biometrics note: ${String(err)}`);
      }
    }

    // Call /api/students/{id}/enroll-face
    try {
      const targetId = hallTicketNo || uid;
      const resp = await fetch(`/api/students/${targetId}/enroll-face`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          faceDescriptor: descriptor,
          hallTicketNo: hallTicketNo,
          studentConsent: true,
          algorithm: descriptor.length === 512 ? 'arcface_512' : 'facenet_128'
        })
      });
      if (resp.ok) {
        persisted = true;
      }
    } catch (err) {
      failures.push(`Backend enroll-face note: ${String(err)}`);
    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              faceDescriptor: descriptor,
              faceEnrollmentStatus: "enrolled",
              faceEnrolledAt: enrolledAt,
              updatedAt: enrolledAt,
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        faceDescriptor: descriptor,
        faceEnrollmentStatus: "enrolled",
        faceEnrolledAt: enrolledAt,
      });
    }

    return true;
  };

  const revokeStudentFace = async (uid: string): Promise<boolean> => {
    const student = users.find(u => u.uid === uid) || (currentUser?.uid === uid ? currentUser : null);
    const hallTicketNo = student?.hallTicketNo;



    // 2. Call backend /api/students/{id}/revoke-face-data
    // Token is now in httpOnly cookie
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    const targetId = hallTicketNo || uid;
    try {
      await fetch(`/api/students/${targetId}/revoke-face-data`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include'
      });
    } catch (e) {
      console.warn("Backend revoke face notice:", e);
    }

    if (hallTicketNo) {
      // No localStorage needed for enrollment state
    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              faceDescriptor: undefined,
              faceEnrollmentStatus: "pending",
              faceEnrolledAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        faceDescriptor: undefined,
        faceEnrollmentStatus: "pending",
        faceEnrolledAt: undefined,
      });
    }

    return true;
  };

  const enrollStudentBiometrics = async (
    uid: string,
    credentialId: string,
    publicKey?: string
  ) => {
    const enrolledAt = new Date().toISOString();
    const student = users.find(u => u.uid === uid) || (currentUser?.uid === uid ? currentUser : null);
    const hallTicketNo = student?.hallTicketNo;



    if (hallTicketNo) {
      try {
        await fetch('/api/student/register-biometrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            hallTicketNo: hallTicketNo,
            name: student?.name || currentUser?.name || `Student (${hallTicketNo})`,
            branch: student?.branch || currentUser?.branch || 'CSE',
            section: student?.section || currentUser?.section || 'A',
            faceDescriptor: student?.faceDescriptor || currentUser?.faceDescriptor,
            biometricCredentialId: credentialId
          })
        });
      } catch (err) {
        console.warn("Backend biometric sync notice:", err);
      }
    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              biometricCredentialId: credentialId,
              biometricPublicKey: publicKey,
              biometricEnrollmentStatus: "enrolled",
              biometricEnrolledAt: enrolledAt,
              updatedAt: enrolledAt,
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        biometricCredentialId: credentialId,
        biometricPublicKey: publicKey,
        biometricEnrollmentStatus: "enrolled",
        biometricEnrolledAt: enrolledAt,
      });
    }
  };

  const registerTrustedDevice = (
    uid: string,
    fingerprint: string,
    deviceName: string
  ) => {
    const registeredAt = new Date().toISOString();

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              trustedDeviceId: fingerprint,
              trustedDeviceName: deviceName,
              trustedDeviceRegisteredAt: registeredAt,
              updatedAt: registeredAt,
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        trustedDeviceId: fingerprint,
        trustedDeviceName: deviceName,
        trustedDeviceRegisteredAt: registeredAt,
      });
    }
  };

  const resetTrustedDevice = (uid: string) => {
    const student = users.find(user => user.uid === uid);

    if (student) {
      sendTrustedDeviceResetEmail(student.name, student.email);
    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              trustedDeviceId: undefined,
              trustedDeviceName: undefined,
              trustedDeviceRegisteredAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        trustedDeviceId: undefined,
        trustedDeviceName: undefined,
        trustedDeviceRegisteredAt: undefined,
      });
    }
  };

  const switchUser = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (user) {
      setCurrentUser(user);
    }
  };

  const pendingStudents = useMemo(
    () =>
      users.filter(
        user => user.role === "student" && user.status === "pending"
      ),
    [users]
  );

  const approvedStudents = users.filter(
    user => user.role === "student" && user.status === "approved"
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        requestPasswordReset,
        resetPasswordWithCode,
        registerAdmin,
        registerFaculty,
        registerStudent,
        insertStudent,
        bulkInsertStudents,
        bulkInsertFaculty,
        updateStudentStatus,
        updateUser,
        deleteUser,
        refreshUsers,
        enrollStudentFace,
        revokeStudentFace,
        enrollStudentBiometrics,
        registerTrustedDevice,
        resetTrustedDevice,
        switchUser,
        pendingStudents,
        approvedStudents,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

