/* eslint-disable no-irregular-whitespace */
// src/contexts/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { useAuth, type AuthHookReturn } from "../hooks/useAuth";

type AuthContextType = AuthHookReturn;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
