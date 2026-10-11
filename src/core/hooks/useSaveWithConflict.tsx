import React, { useState, useCallback } from 'react';
import { ConcurrencyError } from '../errors';
import { ConflictDialog, type ConflictDiffItem } from '../../components/ui/ConflictDialog';

export interface UseSaveWithConflictOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  onReload: () => Promise<void> | void;
  fetchLatest?: () => Promise<T | undefined | null>;
  fieldLabels?: Record<string, string>;
}

export function useSaveWithConflict<T extends Record<string, unknown> = Record<string, unknown>>(
  options: UseSaveWithConflictOptions<T>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    'تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.'
  );
  const [differences, setDifferences] = useState<ConflictDiffItem[]>([]);
  const [isReloading, setIsReloading] = useState(false);

  const saveWithConflict = useCallback(
    async <R,>(saveFn: () => Promise<R>, localData?: T): Promise<R | undefined> => {
      try {
        return await saveFn();
      } catch (err: unknown) {
        if (
          err instanceof ConcurrencyError ||
          (err instanceof Error &&
            (err.name === 'ConcurrencyError' ||
              err.message.includes('تم تعديل هذا السجل بواسطة مستخدم آخر')))
        ) {
          const msg =
            err instanceof Error
              ? err.message
              : 'تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.';
          setErrorMessage(msg);

          if (options.fetchLatest && localData) {
            try {
              const latest = await options.fetchLatest();
              if (latest) {
                const diffList: ConflictDiffItem[] = [];
                const keys = new Set([...Object.keys(localData), ...Object.keys(latest)]);

                for (const key of keys) {
                  if (['version', 'updatedAt', 'updatedBy', 'isDeleted'].includes(key)) continue;
                  const myVal = localData[key];
                  const currentVal = latest[key];

                  if (JSON.stringify(myVal) !== JSON.stringify(currentVal)) {
                    diffList.push({
                      field: key,
                      label: options.fieldLabels?.[key] || key,
                      currentValue: currentVal,
                      myValue: myVal,
                    });
                  }
                }
                setDifferences(diffList);
              }
            } catch {
              // Ignore latest fetch failure and present generic conflict modal
            }
          }

          setIsOpen(true);
          return undefined;
        }

        throw err;
      }
    },
    [options]
  );

  const handleReload = useCallback(async () => {
    setIsReloading(true);
    try {
      await options.onReload();
      setIsOpen(false);
    } finally {
      setIsReloading(false);
    }
  }, [options]);

  const ConflictModal = useCallback(
    () => (
      <ConflictDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onReload={handleReload}
        message={errorMessage}
        differences={differences}
        isReloading={isReloading}
      />
    ),
    [isOpen, handleReload, errorMessage, differences, isReloading]
  );

  return {
    saveWithConflict,
    isConflictOpen: isOpen,
    openConflict: (msg?: string) => {
      if (msg) setErrorMessage(msg);
      setIsOpen(true);
    },
    closeConflict: () => setIsOpen(false),
    ConflictModal,
  };
}
