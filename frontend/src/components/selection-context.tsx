'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Selection = {
  farmId: string | null;
  fieldId: string | null;
  setFarm: (id: string | null) => void;
  setField: (id: string | null) => void;
};

const SelectionContext = createContext<Selection | null>(null);

const FARM_KEY = 'sm_farm';
const FIELD_KEY = 'sm_field';

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);

  useEffect(() => {
    setFarmId(window.localStorage.getItem(FARM_KEY));
    setFieldId(window.localStorage.getItem(FIELD_KEY));
  }, []);

  const value = useMemo<Selection>(
    () => ({
      farmId,
      fieldId,
      setFarm: (id) => {
        setFarmId(id);
        setFieldId(null);
        if (id) window.localStorage.setItem(FARM_KEY, id);
        else window.localStorage.removeItem(FARM_KEY);
        window.localStorage.removeItem(FIELD_KEY);
      },
      setField: (id) => {
        setFieldId(id);
        if (id) window.localStorage.setItem(FIELD_KEY, id);
        else window.localStorage.removeItem(FIELD_KEY);
      },
    }),
    [farmId, fieldId],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
