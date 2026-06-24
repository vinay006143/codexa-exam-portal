import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserType {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'admin';
  rollNumber?: string;
  phone?: string;
  year?: string;
}

interface AuthContextType {
  user: UserType | null;
  token: string | null;
  loading: boolean;
  login: (userData: { token: string; user: UserType }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if token and user exist in local storage on initial mount
    const savedToken = localStorage.getItem('cbt_token');
    const savedUser = localStorage.getItem('cbt_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing stored user data', e);
        localStorage.removeItem('cbt_token');
        localStorage.removeItem('cbt_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (data: { token: string; user: UserType }) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('cbt_token', data.token);
    localStorage.setItem('cbt_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cbt_token');
    localStorage.removeItem('cbt_user');
    window.location.href = '/login'; // Force redirect to login on logout
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
