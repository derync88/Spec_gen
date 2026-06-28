import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

/**
 * Shared list of the user's specs, powering the persistent sidebar (like the
 * conversation history in ChatGPT/Claude). Mounted once around the whole
 * authenticated area so it survives navigation; pages call refresh() after
 * creating, renaming, reviewing, or deleting a spec.
 */
const SpecsContext = createContext(null);

export function SpecsProvider({ children }) {
  const [specs, setSpecs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { specs } = await api.listSpecs();
      setSpecs(specs);
    } catch {
      /* non-fatal — sidebar just stays as-is */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SpecsContext.Provider value={{ specs, loaded, refresh }}>
      {children}
    </SpecsContext.Provider>
  );
}

export const useSpecs = () => useContext(SpecsContext);
