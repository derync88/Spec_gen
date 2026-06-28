import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, loadToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = loadToken();
    if (token) {
      // We don't have a /me round-trip wired into UI state beyond the token;
      // restore a minimal session from storage.
      const saved = localStorage.getItem('specgen_user');
      if (saved) setUser(JSON.parse(saved));
    }
    setReady(true);
  }, []);

  const persist = (token, u) => {
    setToken(token);
    setUser(u);
    localStorage.setItem('specgen_user', JSON.stringify(u));
  };

  const login = async (email, password) => {
    const { token, user: u } = await api.login({ email, password });
    persist(token, u);
  };

  const register = async (email, password, name) => {
    const { token, user: u } = await api.register({ email, password, name });
    persist(token, u);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('specgen_user');
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
