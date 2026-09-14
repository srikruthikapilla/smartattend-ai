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
      // User session is now managed via httpOnly cookies on the backend
      // We'll fetch the current user on mount to restore session
      return null;
    });

  useEffect(() => {
    // Users are now managed on the backend, no localStorage needed
  }, [users]);

  useEffect(() => {
    // Current user is now managed via httpOnly cookies on the backend
    // No localStorage needed for user state
  }, [currentUser]);

  // Synchronization with backend PostgreSQL users table
  const refreshUsers = async (): Promise<void> => {
    // Token is now in httpOnly cookie, no localStorage needed
    const endpoints = [
      '/api/auth/users',
      '/api/auth/users',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/users`
    ].filter(Boolean);

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          credentials: 'include' // Include httpOnly cookie
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
            break;
          }
        }
      } catch (e) {
        // Try next endpoint
      }
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
    let lastError: string | null = null;

    const backendEndpoints = [
      '/api/auth/login',
      '/api/auth/login',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/login`
    ].filter(Boolean);

    for (const ep of backendEndpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: cleanEmail, password, role })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            // Token is now set as httpOnly cookie by backend
            // No localStorage storage needed
            const backendUser: UserProfile = data.user;
            setUsers(prev => {
              const exists = prev.some(u => u.uid === backendUser.uid || u.email === backendUser.email);
              return exists ? prev.map(u => u.email === backendUser.email ? backendUser : u) : [backendUser, ...prev];
            });
            setCurrentUser(backendUser);
            return true;
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          if (errJson.detail) {
            lastError = errJson.detail;
            if (response.status === 401 || response.status === 403 || response.status === 404) {
              break;
            }
          }
        }
      } catch (backendError) {
        console.warn(`Backend auth endpoint ${ep} note:`, backendError);
      }
    }

    if (lastError) {
      throw new Error(lastError);
    }

    throw new Error("Unable to authenticate. Please verify your credentials.");
  };

  const logout = async () => {
    // Call backend logout to clear httpOnly cookie
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // Important: include cookies
      });
    } catch (err) {
      console.warn('Backend logout note:', err);
    }
    
    // Clear local state
    setCurrentUser(null);
    setUsers([]);
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const endpoints = [
      '/api/auth/request-reset',
      '/api/auth/request-reset',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/request-reset`
    ].filter(Boolean);

    for (const ep of endpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: cleanEmail })
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            message: data.message || "Verification code sent to your email."
          };
        }
      } catch (err) {
        console.warn(`Backend request-reset ${ep} notice:`, err);
      }
    }

    throw new Error("Unable to reach authentication server. Please try again.");
  };

  const resetPasswordWithCode = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const endpoints = [
      '/api/auth/reset-password',
      '/api/auth/reset-password',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/reset-password`
    ].filter(Boolean);

    for (const ep of endpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: cleanEmail,
            otp,
            new_password: newPassword
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Failed to reset password.");
        }

        return {
          success: true,
          message: data.message || "Password successfully updated!"
        };
      } catch (err: any) {
        if (err.message && !err.message.includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    throw new Error("Unable to reach authentication server. Please try again.");
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

    // Token is now in httpOnly cookie
    const endpoints = [
      '/api/auth/register',
      '/api/auth/register',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/register`
    ].filter(Boolean);

    let registeredUser: UserProfile | null = null;
    let lastError = "Unable to connect to registration server.";

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        // No Authorization header needed - httpOnly cookie is used

        const res = await fetch(ep, {
          method: 'POST',
          headers,
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
          registeredUser = {
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
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.detail || `Server error (${res.status})`;
          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 409) {
            throw new Error(errMsg);
          }
          lastError = errMsg;
        }
      } catch (err: any) {
        if (err.message && (
          err.message.includes('Administrator') ||
          err.message.includes('Password') ||
          err.message.includes('already exists') ||
          err.message.includes('Server error')
        )) {
          throw err;
        }
        lastError = err.message || lastError;
      }
    }

    if (!registeredUser) {
      throw new Error(lastError);
    }

    await refreshUsers();
    return registeredUser;
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

    // Token is now in httpOnly cookie
    const endpoints = [
      '/api/auth/register',
      '/api/auth/register',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/register`
    ].filter(Boolean);

    let registeredUser: UserProfile | null = null;
    let lastError = "Unable to connect to registration server.";

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        // No Authorization header needed - httpOnly cookie is used

        const res = await fetch(ep, {
          method: 'POST',
          headers,
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
          registeredUser = {
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
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.detail || `Server error (${res.status})`;
          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 409) {
            throw new Error(errMsg);
          }
          lastError = errMsg;
        }
      } catch (err: any) {
        if (err.message && (
          err.message.includes('Administrator') ||
          err.message.includes('Password') ||
          err.message.includes('already exists') ||
          err.message.includes('Server error')
        )) {
          throw err;
        }
        lastError = err.message || lastError;
      }
    }

    if (!registeredUser) {
      throw new Error(lastError);
    }

    await refreshUsers();
    return registeredUser;
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

    const token = localStorage.getItem('sbit_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers,
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
      year: number | string;
      semester?: number | string;
      phone?: string;
      status?: StudentStatus;
    }>
  ): Promise<{ addedCount: number; duplicateCount: number; errors: string[] }> => {
    const errors: string[] = [];
    const newStudentsToAdd: UserProfile[] = [];
    const existingHTs = new Set(users.map(u => u.hallTicketNo?.toUpperCase()).filter(Boolean));
    const existingEmails = new Set(users.map(u => u.email?.toLowerCase()).filter(Boolean));
    let duplicateCount = 0;

    students.forEach((s, idx) => {
      const rowNum = idx + 1;
      const name = s.name?.trim();
      const email = s.email?.trim().toLowerCase();
      const ht = s.hallTicketNo?.trim().toUpperCase();

      if (!name || !email || !ht) {
        errors.push(`Row ${rowNum}: Name, Email, and Hall Ticket Number are required.`);
        return;
      }

      if (!isValidHallTicketNo(ht)) {
        errors.push(`Row ${rowNum}: Hall Ticket "${ht}" is invalid.`);
        return;
      }

      if (existingHTs.has(ht) || existingEmails.has(email)) {
        duplicateCount++;
        return;
      }

      existingHTs.add(ht);
      existingEmails.add(email);

      newStudentsToAdd.push({
        uid: crypto.randomUUID(),
        name: name,
        email: email,
        hallTicketNo: ht,
        branch: s.branch || "CSE",
        section: (s.section || "A").toUpperCase(),
        year: String(s.year || 3),
        semester: String(s.semester || 1),
        phone: s.phone || '',
        role: "student",
        college: SBIT_COLLEGE_NAME,
        status: s.status || "approved",
        createdAt: new Date().toISOString(),
        faceEnrollmentStatus: "pending",
        biometricEnrollmentStatus: "pending",
      });
    });

    if (newStudentsToAdd.length > 0) {
      try {
        const token = localStorage.getItem('sbit_auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // No Authorization header needed - httpOnly cookie is used

        await fetch('/api/auth/users/bulk', {
          method: 'POST',
          headers,
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
      addedCount: newStudentsToAdd.length,
      duplicateCount,
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
      const token = localStorage.getItem('sbit_auth_token');
      const endpoints = [
        '/api/auth/faculty/bulk',
        '/api/auth/faculty/bulk',
        `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/faculty/bulk`
      ].filter(Boolean);

      let saved = false;
      let lastError = 'Failed to bulk import faculty records.';

      for (const ep of endpoints) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          // No Authorization header needed - httpOnly cookie is used

          const res = await fetch(ep, {
            method: 'POST',
            headers,
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

          if (res.ok) {
            saved = true;
            break;
          } else {
            const errJson = await res.json().catch(() => ({}));
            lastError = errJson.detail || `Server error (${res.status})`;
            if (res.status === 400 || res.status === 401 || res.status === 403) {
              throw new Error(lastError);
            }
          }
        } catch (e: any) {
          if (e.message && (e.message.includes('Only') || e.message.includes('Administrator') || e.message.includes('Server error'))) {
            throw e;
          }
          lastError = e.message || lastError;
        }
      }

      if (!saved) {
        throw new Error(lastError);
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
    // Token is now in httpOnly cookie
    const endpoints = [
      `/api/auth/users/${encodeURIComponent(uid)}`,
      `/api/auth/users/${encodeURIComponent(uid)}`,
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/users/${encodeURIComponent(uid)}`
    ].filter(Boolean);

    let updated = false;
    let lastError = 'Failed to update user profile.';

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // No Authorization header needed - httpOnly cookie is used

        const res = await fetch(ep, {
          method: 'PUT',
          headers,
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

        if (res.ok) {
          updated = true;
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData.detail || `Server error (${res.status})`;
          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
            throw new Error(lastError);
          }
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Access denied') || err.message.includes('User') || err.message.includes('Server error'))) {
          throw err;
        }
        lastError = err.message || lastError;
      }
    }

    if (!updated) {
      throw new Error(lastError);
    }

    await refreshUsers();
  };

  const deleteUser = async (uid: string): Promise<void> => {
    // Token is now in httpOnly cookie
    const endpoints = [
      `/api/auth/users/${encodeURIComponent(uid)}`,
      `/api/auth/users/${encodeURIComponent(uid)}`,
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/users/${encodeURIComponent(uid)}`
    ].filter(Boolean);

    let deleted = false;
    let lastError = "Failed to delete user.";

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {};
        // No Authorization header needed - httpOnly cookie is used

        const res = await fetch(ep, {
          method: 'DELETE',
          headers
        });

        if (res.ok) {
          deleted = true;
          break;
        } else {
          const data = await res.json().catch(() => ({}));
          lastError = data.detail || (res.status === 502 ? "Server gateway unreachable. Please retry in a few seconds." : `Server error (${res.status})`);
          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
            throw new Error(lastError);
          }
        }
      } catch (err: any) {
        if (err.message && (
          err.message.includes('Cannot delete') ||
          err.message.includes('Access denied') ||
          err.message.includes('User') ||
          err.message.includes('Server')
        )) {
          throw err;
        }
        lastError = err.message || lastError;
      }
    }

    if (!deleted) {
      throw new Error(lastError);
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

