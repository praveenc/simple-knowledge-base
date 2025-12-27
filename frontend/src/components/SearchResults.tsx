/**
 * Search Results Component
 * Displays the search results from the knowledge base
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, FileText, Loader2, ChevronDown, Clock, Ruler, Info } from 'lucide-react';
import type { SearchResult } from '../api/types';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  indexName: string;
  searchTimeMs: number | null;
  isLoading: boolean;
}

const SIMILARITY_METRIC = 'L2 (Euclidean)';

function formatScore(score: number): number {
  return Math.round(score * 100);
}

function extractFilename(path: string): string {
  return path.split('/').pop() || path;
}

function getBadgeVariant(score: number, minScore: number, maxScore: number, totalResults: number): 'default' | 'secondary' | 'destructive' {
  if (totalResults === 1 || maxScore === minScore) return 'default';
  const range = maxScore - minScore;
  const position = (score - minScore) / range;
  if (position >= 0.67) return 'default';
  if (position >= 0.33) return 'secondary';
  return 'destructive';
}

interface ResultItemProps {
  item: SearchResult;
  rank: number;
  totalResults: number;
  minScore: number;
  maxScore: number;
}

function ResultItem({ item, rank, totalResults, minScore, maxScore }: ResultItemProps) {
  const score = formatScore(item.relevance_score);
  const filename = extractFilename(item.source_document);
  const badgeVariant = getBadgeVariant(item.relevance_score, minScore, maxScore, totalResults);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-muted-foreground">#{rank}</span>
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{filename}</CardTitle>
              <CardDescription className="truncate text-xs">{item.source_document}</CardDescription>
            </div>
          </div>
          <Badge variant={badgeVariant} className="shrink-0">{score}% match</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Relevance</span>
            <span className="font-medium">{item.relevance_score.toFixed(3)}</span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        <Collapsible defaultOpen={rank === 1}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors group w-full">
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            Content preview
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-72 whitespace-pre-wrap break-words font-mono leading-relaxed">
              {item.content}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Chunk offset</p>
            <p className="text-sm font-medium">{item.chunk_offset.toLocaleString()} chars</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Content length</p>
            <p className="text-sm font-medium">{item.content.length.toLocaleString()} chars</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchResults({ results, query, indexName, searchTimeMs, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="font-medium">Searching for relevant content...</p>
              <p className="text-sm text-muted-foreground">Embedding query and searching vector database</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!query) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Enter a query above to search the knowledge base</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Info className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">Try rephrasing your query or using different keywords</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatSearchTime = (ms: number | null): string => {
    if (ms === null) return '—';
    const seconds = (ms / 1000).toFixed(3);
    return `${seconds}s (${ms}ms)`;
  };

  const scores = results.map((r) => r.relevance_score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <CardTitle>Search Results</CardTitle>
          </div>
          <CardDescription>
            Displaying top <strong>{results.length}</strong> results for: <strong>"{query}"</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Index</p>
                <p className="font-medium text-primary">{indexName || 'Default'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Similarity Metric</p>
                <p className="font-medium">{SIMILARITY_METRIC}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Search Time</p>
                <p className="font-medium">{formatSearchTime(searchTimeMs)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {results.map((item, index) => (
          <ResultItem
            key={`${item.source_document}-${item.chunk_offset}`}
            item={item}
            rank={index + 1}
            totalResults={results.length}
            minScore={minScore}
            maxScore={maxScore}
          />
        ))}
      </div>
    </div>
  );
}
