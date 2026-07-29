'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { diseaseReportSchema, paginated, type DiseaseReport } from '@/lib/schemas';

export function useDiseaseReports(fieldId?: string) {
  return useQuery({
    queryKey: ['disease-reports', { field: fieldId ?? null }],
    queryFn: () =>
      api.get('/diseases/reports', paginated(diseaseReportSchema), { query: { field: fieldId } }),
    select: (d) => d.results,
  });
}

export function useDiseaseDetect() {
  const qc = useQueryClient();
  return useMutation<DiseaseReport, Error, { field: string; image: File }>({
    mutationFn: ({ field, image }) => {
      const form = new FormData();
      form.append('field', field);
      form.append('image', image);
      return api.postForm('/diseases/detect', form, diseaseReportSchema);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disease-reports'] }),
  });
}
