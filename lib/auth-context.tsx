import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "@/src/lib/api";

export type UserRole = "gudang" | "logistik" | "dealer" | "manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mockUsers: Record<UserRole, User> = {
  gudang: {
    id: "1",
    name: "Ahmad Santoso",
    email: "gudang@supplytrack.com",
    role: "gudang",
  },
  logistik: {
    id: "2",
    name: "Budi Prasetyo",
    email: "logistik@supplytrack.com",
    role: "logistik",
  },
  dealer: {
    id: "3",
    name: "Citra Dewi",
    email: "dealer@supplytrack.com",
    role: "dealer",
  },
  manager: {
    id: "4",
    name: "Dian Kusuma",
    email: "manager@supplytrack.com",
    role: "manager",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Bug #3 fix: baca user dari localStorage saat pertama load
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("sc_user");
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Helper: simpan ke localStorage sekaligus update state
  const persistUser = (u: User | null) => {
    if (u) {
      localStorage.setItem("sc_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("sc_user");
    }
    setUser(u);
  };

  const login = async (email: string, password: string, role?: UserRole): Promise<boolean> => {
    setIsLoading(true);
    try {
      const loggedInUser = await api.login({ email, password, role });
      persistUser({
        id: String(loggedInUser.id),
        name: loggedInUser.name,
        email: loggedInUser.email,
        role: loggedInUser.role,
      });
      return true;
    } catch {
      const foundUser = Object.values(mockUsers).find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && (!role || u.role === role)
      );

      if (foundUser && password === "demo123") {
        persistUser(foundUser);
        return true;
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    persistUser(null); // hapus localStorage sekaligus reset state
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
