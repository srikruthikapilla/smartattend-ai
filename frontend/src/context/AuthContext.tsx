import React, {
  createContext,
  useContext,
  useEffect,
  useState,
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

import { supabase } from "../config/supabase";

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

  updateStudentStatus(
    uid: string,
    status: StudentStatus
  ): void;

  updateUser(
    uid: string,
    updates: Partial<UserProfile>
  ): void;

  deleteUser(uid: string): void;

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

  const [users, setUsers] =
    useState<UserProfile[]>(() => {
      const saved = localStorage.getItem("sbit_users");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.filter((u: UserProfile) => 
            !['student_301', 'student_302', 'student_303', 'student_304', 'student_305', 'admin_101', 'faculty_201', 'faculty_202'].includes(u.uid) &&
            !['p.srinivas@sbit.ac.in', 'm.radhika@sbit.ac.in', 'admin@sbit.ac.in'].includes(u.email?.toLowerCase() || '') &&
            !['21SBIT0501', '21SBIT0502', '21SBIT0503', '22SBIT0401', '22SBIT0402'].includes(u.hallTicketNo || '')
          );
        } catch {
          return [];
        }
      }
      return [];
    });

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(() => {
      const saved = localStorage.getItem("sbit_current_user");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (
            !parsed ||
            ['admin_101', 'faculty_201', 'faculty_202', 'student_301'].includes(parsed?.uid) ||
            ['p.srinivas@sbit.ac.in', 'm.radhika@sbit.ac.in', 'admin@sbit.ac.in'].includes(parsed?.email?.toLowerCase() || '') ||
            (parsed?.name && parsed.name.toLowerCase().includes('srinivas'))
          ) {
            localStorage.removeItem("sbit_current_user");
            return null;
          }
          return parsed;
        } catch {
          return null;
        }
      }
      return null;
    });

  useEffect(() => {
    localStorage.setItem(
      "sbit_users",
      JSON.stringify(users)
    );
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        "sbit_current_user",
        JSON.stringify(currentUser)
      );
    } else {
      localStorage.removeItem(
        "sbit_current_user"
      );
    }
  }, [currentUser]);

  // Synchronization with backend PostgreSQL users table
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('sbit_auth_token');
      if (!token) return;

      const endpoints = ['/api/auth/users', 'http://localhost:5000/api/auth/users'];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.users && data.users.length > 0) {
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

              setUsers(prev => {
                const map = new Map<string, UserProfile>();
                prev.forEach(u => map.set(u.email.toLowerCase(), u));
                mapped.forEach(u => map.set(u.email.toLowerCase(), u));
                return Array.from(map.values());
              });
              break;
            }
          }
        } catch (e) {
          // Try next endpoint
        }
      }
    };

    fetchUsers();
  }, [currentUser]);

  const login = async (
    email: string,
    password?: string,
    role?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    let lastError: string | null = null;

    // 1. First Tier: Supabase Auth Verification (Authentication Only)
    if (supabase && password) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (authErr) {
          const msg = (authErr.message || '').toLowerCase();
          if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            lastError = 'Invalid email or password.';
          } else if (!msg.includes('email not confirmed')) {
            console.warn('Supabase sign-in notice:', authErr.message);
          }
        }
      } catch (supabaseError: any) {
        console.warn("Supabase auth login notice:", supabaseError?.message);
      }
    }

    // 2. Second Tier: FastAPI Backend Auth API (/api/auth/login)
    const backendEndpoints = [
      '/api/auth/login',
      'http://localhost:5000/api/auth/login',
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/login`
    ].filter(Boolean);

    for (const ep of backendEndpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password, role })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            if (data.access_token) {
              localStorage.setItem('sbit_auth_token', data.access_token);
            }
            const backendUser: UserProfile = data.user;
            setUsers(prev => {
              const exists = prev.some(u => u.uid === backendUser.uid || u.email === backendUser.email);
              return exists ? prev.map(u => u.email === backendUser.email ? backendUser : u) : [backendUser, ...prev];
            });
            setCurrentUser(backendUser);
            localStorage.setItem("sbit_current_user", JSON.stringify(backendUser));
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
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Safe logout
      }
    }
    localStorage.removeItem('sbit_auth_token');
    localStorage.removeItem('sbit_current_user');
    setCurrentUser(null);
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    try {
      const response = await fetch(`${apiBase}/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.warn("Backend request-reset notice:", err);
    }

    if (supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
        return {
          success: true,
          message: "Password reset link sent to your email address."
        };
      } catch (err: any) {
        throw new Error(err.message || "Failed to initiate password reset.");
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
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    try {
      const response = await fetch(`${apiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      throw new Error(err.message || "Failed to update password.");
    }
  };

  const registerAdmin = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    let uid: string = crypto.randomUUID();

    if (supabase && password) {
      try {
        const { data: authData } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: data.name, role: 'admin' } }
        });
        if (authData?.user) uid = authData.user.id;
      } catch (err) {
        console.warn("Supabase auth signUp notice:", err);
      }
    }

    const newAdmin: UserProfile = {
      ...data,
      uid,
      email: cleanEmail,
      role: "admin",
      college: SBIT_COLLEGE_NAME,
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: data.name.trim(),
          phone: data.phone || null,
          role: 'admin',
          college: data.college || SBIT_COLLEGE_NAME,
          designation: data.designation || 'Administrator',
          department: data.department || null,
          status: 'approved'
        })
      });
    } catch (err) {
      console.warn("Backend register admin notice:", err);
    }

    setUsers(prev => [newAdmin, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)]);
    setCurrentUser(newAdmin);
    return newAdmin;
  };

  const registerFaculty = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >,
    password?: string
  ): Promise<UserProfile> => {
    const cleanEmail = data.email.toLowerCase().trim();
    let uid: string = crypto.randomUUID();

    if (supabase && password) {
      try {
        const { data: authData } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: data.name, role: 'faculty' } }
        });
        if (authData?.user) uid = authData.user.id;
      } catch (err) {
        console.warn("Supabase auth faculty signUp notice:", err);
      }
    }

    const newFaculty: UserProfile = {
      ...data,
      uid,
      email: cleanEmail,
      role: "faculty",
      college: SBIT_COLLEGE_NAME,
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: data.name.trim(),
          phone: data.phone || null,
          role: 'faculty',
          college: data.college || SBIT_COLLEGE_NAME,
          designation: data.designation || 'Faculty Member',
          department: data.department || 'Computer Science & Engineering',
          assigned_branch: data.assignedBranch || 'CSE',
          assigned_sections: data.assignedSections || ['A', 'B'],
          status: 'approved'
        })
      });
    } catch (err) {
      console.warn("Backend register faculty notice:", err);
    }

    setUsers(prev => [newFaculty, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)]);
    setCurrentUser(newFaculty);
    return newFaculty;
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
        await fetch('/api/auth/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    try {
      await fetch(`/api/auth/users/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.warn("Backend updateUser notice:", err);
    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : user
      )
    );

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser({
        ...currentUser,
        ...updates,
      });
    }
  };

  const deleteUser = async (uid: string) => {
    try {
      await fetch(`/api/auth/users/${uid}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Backend deleteUser notice:", err);
    }

    setUsers(prev => prev.filter(user => user.uid !== uid));

    if (currentUser && currentUser.uid === uid) {
      setCurrentUser(null);
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
    const token = localStorage.getItem('sbit_auth_token') || localStorage.getItem('token');
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    if (hallTicketNo) {
      try {
        const resp = await fetch('/api/student/register-biometrics', {
          method: 'POST',
          headers: authHeaders,
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
    const token = localStorage.getItem('sbit_auth_token') || localStorage.getItem('token');
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const targetId = hallTicketNo || uid;
    try {
      await fetch(`/api/students/${targetId}/revoke-face-data`, {
        method: 'DELETE',
        headers: authHeaders
      });
    } catch (e) {
      console.warn("Backend revoke face notice:", e);
    }

    if (hallTicketNo) {
      localStorage.removeItem(`enrolled_${hallTicketNo}`);
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

  const pendingStudents = users.filter(
    user => user.role === "student" && user.status === "pending"
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
        updateStudentStatus,
        updateUser,
        deleteUser,
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
