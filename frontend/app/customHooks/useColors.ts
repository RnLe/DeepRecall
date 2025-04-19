// src/customHooks/useColors.ts

import {
    fetchColorSchemes,
    createColorScheme,
    updateColorScheme,
    deleteColorScheme,
  } from "../api/colorSchemeService";
  import { ColorScheme } from "../types/colorSchemeTypes";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  
  const SCHEMES_KEY = ["colorSchemes"];
  
  export function useColors() {
    const qc = useQueryClient();
  
    const {
      data: schemes = [],
      isLoading,
      error,
    } = useQuery<ColorScheme[]>({
      queryKey: SCHEMES_KEY,
      queryFn: fetchColorSchemes,
    });
  
    const createMutation = useMutation<ColorScheme, Error, Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt">>({
      mutationFn: (newScheme) => createColorScheme(newScheme),
      onSuccess: () => qc.invalidateQueries({ queryKey: SCHEMES_KEY }),
    });
  
    const updateMutation = useMutation<
      ColorScheme,
      Error,
      { documentId: string; scheme: Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt"> }
    >({
      mutationFn: ({ documentId, scheme }) => updateColorScheme(documentId, scheme),
      onSuccess: () => qc.invalidateQueries({ queryKey: SCHEMES_KEY }),
    });
  
    const deleteMutation = useMutation<void, Error, string>({
      mutationFn: (documentId) => deleteColorScheme(documentId),
      onSuccess: () => qc.invalidateQueries({ queryKey: SCHEMES_KEY }),
    });
  
    return {
      schemes,
      isLoading,
      error,
      createScheme: createMutation.mutateAsync,
      updateScheme: updateMutation.mutateAsync,
      deleteScheme: deleteMutation.mutateAsync,
    };
  }
