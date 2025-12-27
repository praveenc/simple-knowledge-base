/**
 * IndexSelector Component
 * Reusable component for selecting an index from available indexes
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Folder, Loader2 } from 'lucide-react';

import { listIndexes, getIndexRecordCount } from '../api/client';

interface IndexSelectorProps {
  selectedIndex: string | null;
  onIndexChange: (indexName: string | null) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  refreshTrigger?: number;
}

interface IndexOption {
  label: string;
  value: string;
  recordCount: number;
}

export function IndexSelector({
  selectedIndex,
  onIndexChange,
  disabled = false,
  label = 'Index',
  description = 'Select an index to work with',
  refreshTrigger = 0,
}: IndexSelectorProps) {
  const [options, setOptions] = useState<IndexOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIndexes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listIndexes();

      const counts: Record<string, number> = {};
      await Promise.all(
        response.indexes.map(async (indexName) => {
          try {
            const countResponse = await getIndexRecordCount(indexName);
            counts[indexName] = countResponse.record_count;
          } catch {
            counts[indexName] = -1;
          }
        })
      );

      const indexOptions: IndexOption[] = response.indexes.map((indexName) => ({
        label: indexName,
        value: indexName,
        recordCount: counts[indexName] ?? -1,
      }));

      setOptions(indexOptions);

      if (selectedIndex && !response.indexes.includes(selectedIndex)) {
        onIndexChange(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load indexes';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIndex, onIndexChange]);

  useEffect(() => {
    loadIndexes();
  }, [loadIndexes, refreshTrigger]);

  const handleChange = (value: string) => {
    onIndexChange(value || null);
  };

  const selectedOption = options.find((opt) => opt.value === selectedIndex);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Select
        value={selectedIndex || ''}
        onValueChange={handleChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading indexes...</span>
            </div>
          ) : (
            <SelectValue placeholder="Select an index" />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="p-2 text-center text-sm text-muted-foreground">
              No indexes found. Create one first.
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span>{option.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {option.recordCount >= 0 ? `${option.recordCount.toLocaleString()} records` : 'N/A'}
                  </Badge>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {selectedIndex && selectedOption && selectedOption.recordCount >= 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedOption.recordCount.toLocaleString()} records in index
        </p>
      )}
    </div>
  );
}
