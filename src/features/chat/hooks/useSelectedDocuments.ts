'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

const STORAGE_KEY_PREFIX = 'chat-selected-documents';

/**
 * Hook para gestionar documentos seleccionados en el chat
 * Persiste la selección en localStorage
 */
export function useSelectedDocuments() {
  const { user } = useUser();
  const storageKey = user?.id
    ? `${STORAGE_KEY_PREFIX}-${user.id}`
    : `${STORAGE_KEY_PREFIX}-anonymous`;

  const [selectedDocuments, setSelectedDocumentsState] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Cargar desde localStorage al montar
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedDocumentsState(parsed);
        }
      }
    } catch (error) {
      console.warn('Error loading selected documents from localStorage:', error);
    }
  }, [storageKey]);

  // Persistir en localStorage cuando cambia la selección
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(selectedDocuments));
      } catch (error) {
        console.warn('Error saving selected documents to localStorage:', error);
      }
    }
  }, [selectedDocuments, storageKey, isMounted]);

  const setSelectedDocuments = (paths: string[]) => {
    setSelectedDocumentsState(paths);
  };

  const toggleDocument = (path: string) => {
    setSelectedDocumentsState((current) => {
      if (current.includes(path)) {
        return current.filter(p => p !== path);
      }
      return [...current, path];
    });
  };

  const clearSelection = () => {
    setSelectedDocumentsState([]);
  };

  const isSelected = (path: string) => {
    return selectedDocuments.includes(path);
  };

  const removeDocument = (path: string) => {
    setSelectedDocumentsState(current => current.filter(p => p !== path));
  };

  return {
    selectedDocuments,
    setSelectedDocuments,
    toggleDocument,
    clearSelection,
    isSelected,
    removeDocument,
  };
}
