/**
 * Search Interface Component
 * Main search input with index selection and submit functionality
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2, Lightbulb, Info } from 'lucide-react';

import { IndexSelector } from './IndexSelector';

interface SearchInterfaceProps {
  onSearch: (query: string, indexName: string) => void;
  isLoading: boolean;
}

export function SearchInterface({ onSearch, isLoading }: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);

  const canSearch = query.trim() && selectedIndex;

  const handleSubmit = () => {
    if (canSearch) {
      onSearch(query.trim(), selectedIndex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSearch && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Lightbulb className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Search Knowledge Base</CardTitle>
            <CardDescription>
              Search through your knowledge base using natural language queries
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <IndexSelector
              selectedIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
              disabled={isLoading}
              label="Search Index"
              description="Select the index to search"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Search Query</Label>
            <p className="text-sm text-muted-foreground">Enter your question or search terms</p>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., How do I create a table in LanceDB?"
              disabled={isLoading || !selectedIndex}
              className="text-base"
            />
          </div>
        </div>

        {!selectedIndex && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Select an index to search. If no indexes exist, go to the "Manage Indexes" tab to create one.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSearch || isLoading}
          className="gap-2"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
