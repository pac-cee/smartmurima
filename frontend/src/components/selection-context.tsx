'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Selection = {
  farmId: string | null;
  fieldId: string | null;
  setFarm: (id: string | null) => void;
  setField: (id: string | null) => void;
};

const SelectionContext = createContext<Selection | null>(null);

const FARM_KEY = 'sm_farm';
const FIELD_KEY = 'sm_field';

// Read synchronously so sensor queries can fire on the first paint instead of
// waiting for an effect (which would create a farm->field->readings waterfall).
function readStored(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [farmId, setFarmId] = useState<string | null>(() => readStored(FARM_KEY));
  const [fieldId, setFieldId] = useState<string | null>(() => readStored(FIELD_KEY));

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
