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
  ): Promise<{ success: boolean; message: string; otpCode?: string }>;

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

  // Real-time synchronization with Supabase users table (with backend API fallback)
  useEffect(() => {
    const fetchUsers = async () => {
      let loaded = false;

      // 1. Try Supabase direct query
      if (supabase) {
        try {
          const { data: dbUsers, error } = await supabase.from('users').select('*');
          if (!error && dbUsers && dbUsers.length > 0) {
            const mapped: UserProfile[] = dbUsers.map(u => ({
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
            loaded = true;
          }
        } catch (err) {
          console.warn("Supabase direct users fetch notice:", err);
        }
      }

      // 2. If direct Supabase failed or returned empty, query backend proxy
      if (!loaded) {
        const endpoints = ['/api/auth/users', 'http://localhost:5000/api/auth/users'];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
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
      }
    };

    fetchUsers();

    // Subscribe to realtime database changes on users table if Supabase is connected
    if (supabase) {
      const channel = supabase
        .channel('realtime-users-stream')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'users' },
          (payload: any) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const u = payload.new;
              const updatedUser: UserProfile = {
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
              };

              setUsers(prev => {
                const filtered = prev.filter(user => user.email.toLowerCase() !== updatedUser.email.toLowerCase() && user.uid !== updatedUser.uid);
                return [updatedUser, ...filtered];
              });

              setCurrentUser(curr => (curr && (curr.uid === updatedUser.uid || curr.email.toLowerCase() === updatedUser.email.toLowerCase()) ? updatedUser : curr));
            } else if (payload.eventType === 'DELETE') {
              const oldId = payload.old?.id;
              if (oldId) {
                setUsers(prev => prev.filter(user => user.uid !== oldId));
                setCurrentUser(curr => (curr?.uid === oldId ? null : curr));
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const login = async (
    email: string,
    password?: string,
    role?: string
  ): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    let lastError: string | null = null;

    // 1. First Tier: Direct Supabase Auth & Database Query
    if (supabase) {
      try {
        let authUserId: string | null = null;
        if (password) {
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
          if (authData?.user) {
            authUserId = authData.user.id;
          }
        }

        const { data: dbUser, error: dbErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', cleanEmail)
          .single();

        if (dbUser && !dbErr) {
          if (role && dbUser.role && dbUser.role !== role) {
            throw new Error(`Account exists but is registered as '${dbUser.role.toUpperCase()}', not '${role.toUpperCase()}'.`);
          }

          if (dbUser.role === 'student' && dbUser.status !== 'approved') {
            throw new Error(`Your account status is '${dbUser.status || 'pending'}'. An administrator must approve your registration first.`);
          }

          const detectedRole = dbUser.role || role || 'faculty';

          const mappedUser: UserProfile = {
            uid: dbUser.id || authUserId || `user_${Date.now()}`,
            email: dbUser.email,
            name: dbUser.name || dbUser.full_name || cleanEmail.split('@')[0],
            phone: dbUser.phone || '',
            role: detectedRole as any,
            college: dbUser.college || SBIT_COLLEGE_NAME,
            designation: dbUser.designation || (detectedRole === 'admin' ? 'Administrator' : 'Faculty Member'),
            department: dbUser.department,
            assignedBranch: dbUser.assigned_branch,
            assignedSections: dbUser.assigned_sections,
            status: dbUser.status || 'approved',
            createdAt: dbUser.created_at || new Date().toISOString()
          };

          setUsers(prev => {
            const exists = prev.some(u => u.uid === mappedUser.uid || u.email === mappedUser.email);
            return exists ? prev.map(u => u.email === mappedUser.email ? mappedUser : u) : [mappedUser, ...prev];
          });

          setCurrentUser(mappedUser);
          localStorage.setItem("sbit_current_user", JSON.stringify(mappedUser));
          return true;
        }
      } catch (supabaseError: any) {
        const errorMsg = (supabaseError?.message || '').toLowerCase();
        if (errorMsg.includes('registered as') || errorMsg.includes('approved')) {
          throw supabaseError;
        }
        console.warn("Direct Supabase login fallback triggered:", supabaseError?.message);
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

    // 3. Third Tier: Local Stored & Cached Users
    const localMatch = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (localMatch) {
      if (role && localMatch.role !== role) {
        throw new Error(`Account exists but is registered as '${localMatch.role.toUpperCase()}', not '${role.toUpperCase()}'.`);
      }
      if (localMatch.role === 'student' && localMatch.status !== 'approved') {
        throw new Error(`Your account status is '${localMatch.status || 'pending'}'. An administrator must approve your registration first.`);
      }
      setCurrentUser(localMatch);
      localStorage.setItem("sbit_current_user", JSON.stringify(localMatch));
      return true;
    }

    if (lastError) {
      throw new Error(lastError);
    }

    throw new Error("Unable to authenticate. Please check your email, password, and server connection.");
  };

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Safe logout
      }
    }
    setCurrentUser(null);
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string; otpCode?: string }> => {
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
          message: data.message || "Verification code generated.",
          otpCode: data.otp_code
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

    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: uid,
          email: cleanEmail,
          name: data.name.trim(),
          phone: data.phone || null,
          role: 'admin',
          college: data.college || SBIT_COLLEGE_NAME,
          designation: data.designation || 'Administrator',
          department: data.department || null,
          status: 'approved'
        }, { onConflict: 'email' });
      } catch (err) {
        console.warn("Supabase register admin notice:", err);
      }
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

    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: uid,
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
        }, { onConflict: 'email' });
      } catch (err) {
        console.warn("Supabase register faculty notice:", err);
      }
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

    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: uid,
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
          status: 'approved',
          face_enrollment_status: 'pending'
        }, { onConflict: 'email' });
      } catch (err) {
        console.warn("Supabase register student notice:", err);
      }
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

    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: uid,
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
          status: data.status || 'approved',
          face_enrollment_status: 'pending'
        }, { onConflict: 'email' });
      } catch (err) {
        console.warn("Supabase insertStudent notice:", err);
      }
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
      if (supabase) {
        try {
          const dbRows = newStudentsToAdd.map(s => ({
            id: s.uid,
            email: s.email,
            name: s.name,
            hall_ticket_no: s.hallTicketNo,
            branch: s.branch,
            section: s.section,
            year: String(s.year),
            semester: String(s.semester || 1),
            phone: s.phone || null,
            role: 'student',
            college: SBIT_COLLEGE_NAME,
            status: s.status || 'approved',
            face_enrollment_status: 'pending'
          }));
          await supabase.from('users').upsert(dbRows, { onConflict: 'email' });
        } catch (err) {
          console.warn("Supabase bulk insert notice:", err);
        }
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
    if (supabase) {
      try {
        const payload: Record<string, any> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.email !== undefined) payload.email = updates.email.toLowerCase();
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.department !== undefined) payload.department = updates.department;
        if (updates.designation !== undefined) payload.designation = updates.designation;
        if (updates.assignedBranch !== undefined) payload.assigned_branch = updates.assignedBranch;
        if (updates.assignedSections !== undefined) payload.assigned_sections = updates.assignedSections;
        if (updates.branch !== undefined) payload.branch = updates.branch;
        if (updates.section !== undefined) payload.section = updates.section;
        if (updates.year !== undefined) payload.year = String(updates.year);
        if (updates.semester !== undefined) payload.semester = String(updates.semester);
        if (updates.status !== undefined) payload.status = updates.status;

        if (Object.keys(payload).length > 0) {
          payload.updated_at = new Date().toISOString();
          await supabase
            .from('users')
            .update(payload)
            .or(`id.eq.${uid},email.eq.${updates.email || ''}`);
        }
      } catch (err) {
        console.warn("Supabase updateUser notice:", err);
      }
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
    if (supabase) {
      try {
        await supabase.from('users').delete().eq('id', uid);
      } catch (err) {
        console.warn("Supabase deleteUser notice:", err);
      }
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

    // 1. Supabase sync
    try {
      if (supabase) {
        const { error } = await supabase
          .from('users')
          .update({
            face_descriptor: descriptor,
            face_enrollment_status: 'enrolled',
            face_enrolled_at: enrolledAt,
            updated_at: enrolledAt
          })
          .eq('id', uid);
        if (error) {
          failures.push(`Supabase update failed: ${error.message}`);
        } else {
          persisted = true;
        }
      }
    } catch (e) {
      failures.push(`Supabase update failed: ${String(e)}`);
    }

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

    // 1. Supabase sync
    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            face_descriptor: null,
            face_enrollment_status: 'pending',
            face_enrolled_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', uid);
      } catch (e) {
        console.warn("Supabase revoke face notice:", e);
      }
    }

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

    if (supabase) {
      try {
        await supabase
          .from('users')
          .update({
            biometric_credential_id: credentialId,
            biometric_public_key: publicKey || null,
            biometric_enrollment_status: 'enrolled',
            biometric_enrolled_at: enrolledAt,
            updated_at: enrolledAt
          })
          .eq('id', uid);
      } catch (e) {
        console.warn("Biometric enrollment db sync notice:", e);
      }
    }

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
