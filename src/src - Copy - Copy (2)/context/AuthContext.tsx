import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  UserProfile,
  StudentStatus,
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
    role: string
  ): Promise<boolean>;

  logout(): void;

  registerAdmin(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile>;

  registerFaculty(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile>;

  registerStudent(
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile>;

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
  ): void;

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

      const saved =
        localStorage.getItem("sbit_users");

      return saved
        ? JSON.parse(saved)
        : initialUsers;

    });

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(() => {

      const saved =
        localStorage.getItem(
          "sbit_current_user"
        );

      if (saved) {

        try {

          return JSON.parse(saved);

        } catch {

          return initialUsers[0];

        }

      }

      return initialUsers[0];

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

  const login = async (
    email: string,
    role: string
  ): Promise<boolean> => {

    const found = users.find(
      user =>
        user.email.toLowerCase() ===
          email.toLowerCase() &&
        user.role === role
    );

    if (!found) return false;

    if (
      found.role === "student" &&
      found.status !== "approved"
    ) {

      throw new Error(
        `Your account status is currently '${found.status.toUpperCase()}'. An administrator must approve your registration before you can log in.`
      );

    }

    setCurrentUser(found);

    return true;

  };

  const logout = () => {

    setCurrentUser(null);

  };
    const registerAdmin = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile> => {

    const newAdmin: UserProfile = {
      ...data,
      uid: `admin_${Date.now()}`,
      role: "admin",
      college: SBIT_COLLEGE_NAME,
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [newAdmin, ...prev]);

    setCurrentUser(newAdmin);

    return newAdmin;

  };

  const registerFaculty = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile> => {

    const newFaculty: UserProfile = {
      ...data,
      uid: `faculty_${Date.now()}`,
      role: "faculty",
      college: SBIT_COLLEGE_NAME,
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [newFaculty, ...prev]);

    return newFaculty;

  };

  const registerStudent = async (
    data: Omit<
      UserProfile,
      "uid" | "role" | "status" | "createdAt"
    >
  ): Promise<UserProfile> => {

    const newStudent: UserProfile = {
      ...data,
      uid: `student_${Date.now()}`,
      role: "student",
      college: SBIT_COLLEGE_NAME,
      status: "pending",
      createdAt: new Date().toISOString(),
      faceEnrollmentStatus: "pending",
    };

    setUsers(prev => [newStudent, ...prev]);

    return newStudent;

  };

  const updateStudentStatus = (
    uid: string,
    status: StudentStatus
  ) => {

    const student = users.find(
      u => u.uid === uid
    );

    if (student) {

      sendRegistrationStatusEmail(
        student.name,
        student.email,
        status === "approved"
          ? "approved"
          : status === "rejected"
          ? "rejected"
          : "suspended"
      );

    }

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              status,
              updatedAt:
                new Date().toISOString(),
            }
          : user
      )
    );

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser({
        ...currentUser,
        status,
      });

    }

  };

  const updateUser = (
    uid: string,
    updates: Partial<UserProfile>
  ) => {

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              ...updates,
              updatedAt:
                new Date().toISOString(),
            }
          : user
      )
    );

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser({
        ...currentUser,
        ...updates,
      });

    }

  };

  const deleteUser = (
    uid: string
  ) => {

    setUsers(prev =>
      prev.filter(
        user => user.uid !== uid
      )
    );

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser(null);

    }

  };

  const enrollStudentFace = (
    uid: string,
    descriptor: number[]
  ) => {

    const enrolledAt =
      new Date().toISOString();

    setUsers(prev =>
      prev.map(user =>
        user.uid === uid
          ? {
              ...user,
              faceDescriptor: descriptor,
              faceEnrollmentStatus:
                "enrolled",
              faceEnrolledAt:
                enrolledAt,
              updatedAt:
                enrolledAt,
            }
          : user
      )
    );

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser({
        ...currentUser,
        faceDescriptor: descriptor,
        faceEnrollmentStatus:
          "enrolled",
        faceEnrolledAt:
          enrolledAt,
      });

    }

  };
    const registerTrustedDevice = (
    uid: string,
    fingerprint: string,
    deviceName: string
  ) => {

    const registeredAt =
      new Date().toISOString();

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

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser({
        ...currentUser,
        trustedDeviceId: fingerprint,
        trustedDeviceName: deviceName,
        trustedDeviceRegisteredAt: registeredAt,
      });

    }

  };

  const resetTrustedDevice = (
    uid: string
  ) => {

    const student = users.find(
      user => user.uid === uid
    );

    if (student) {

      sendTrustedDeviceResetEmail(
        student.name,
        student.email
      );

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

    if (
      currentUser &&
      currentUser.uid === uid
    ) {

      setCurrentUser({
        ...currentUser,
        trustedDeviceId: undefined,
        trustedDeviceName: undefined,
        trustedDeviceRegisteredAt: undefined,
      });

    }

  };

  const switchUser = (
    uid: string
  ) => {

    const user = users.find(
      u => u.uid === uid
    );

    if (user) {

      setCurrentUser(user);

    }

  };

  const pendingStudents =
    users.filter(
      user =>
        user.role === "student" &&
        user.status === "pending"
    );

  const approvedStudents =
    users.filter(
      user =>
        user.role === "student" &&
        user.status === "approved"
    );

  return (

    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        registerAdmin,
        registerFaculty,
        registerStudent,
        updateStudentStatus,
        updateUser,
        deleteUser,
        enrollStudentFace,
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

  const context =
    useContext(AuthContext);

  if (!context) {

    throw new Error(
      "useAuth must be used within an AuthProvider"
    );

  }

  return context;

};