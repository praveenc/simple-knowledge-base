/**
 * ManageIndexes Component
 * Page for creating and deleting indexes in the knowledge base
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderPlus,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Settings
} from 'lucide-react';

import { IndexSelector } from './IndexSelector';
import { createIndex, deleteIndex, getIndexRecordCount } from '../api/client';

const INDEX_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

interface ManageIndexesProps {
  onNotification: (
    type: 'success' | 'error' | 'warning' | 'info' | 'in-progress',
    header: string,
    content?: ReactNode,
    options?: { id?: string; loading?: boolean; dismissible?: boolean }
  ) => string;
  onRemoveNotification: (id: string) => void;
  onNavigateToAddKnowledge: (indexName: string) => void;
  onIndexChange: () => void;
  hasIndexes: boolean;
}

export function ManageIndexes({ onNotification, onNavigateToAddKnowledge, onIndexChange, hasIndexes }: ManageIndexesProps) {
  const [actionMode, setActionMode] = useState<'create' | 'delete'>('create');
  const [newIndexName, setNewIndexName] = useState('');
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);
  const [createdIndexName, setCreatedIndexName] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [isDeletingIndex, setIsDeletingIndex] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteIndexRecordCount, setDeleteIndexRecordCount] = useState<number | null>(null);

  const isValidIndexName = INDEX_NAME_PATTERN.test(newIndexName);
  const indexNameError = newIndexName && !isValidIndexName
    ? 'Must start with a letter, followed by letters, numbers, underscores, or hyphens'
    : '';

  const handleCreateIndex = useCallback(async () => {
    if (!newIndexName || !isValidIndexName) return;

    setIsCreatingIndex(true);
    setCreatedIndexName(null);
    try {
      const response = await createIndex({ index_name: newIndexName });
      onNotification('success', 'Index created', response.message);
      setCreatedIndexName(newIndexName);
      setNewIndexName('');
      setIndexRefreshTrigger((prev) => prev + 1);
      onIndexChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create index';
      onNotification('error', 'Failed to create index', message);
    } finally {
      setIsCreatingIndex(false);
    }
  }, [newIndexName, isValidIndexName, onNotification, onIndexChange]);

  const handleShowDeleteConfirm = useCallback(async () => {
    if (selectedIndex) {
      try {
        const response = await getIndexRecordCount(selectedIndex);
        setDeleteIndexRecordCount(response.record_count);
      } catch {
        setDeleteIndexRecordCount(null);
      }
    }
    setShowDeleteConfirmModal(true);
  }, [selectedIndex]);

  const handleDeleteIndex = useCallback(async () => {
    if (!selectedIndex) return;

    setIsDeletingIndex(true);
    setShowDeleteConfirmModal(false);

    try {
      const response = await deleteIndex(selectedIndex);
      onNotification('success', 'Index deleted', response.message);
      setSelectedIndex(null);
      setIndexRefreshTrigger((prev) => prev + 1);
      onIndexChange();
      setActionMode('create');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete index';
      onNotification('error', 'Failed to delete index', message);
    } finally {
      setIsDeletingIndex(false);
    }
  }, [selectedIndex, onNotification, onIndexChange]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Settings className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle>Manage Indexes</CardTitle>
              <CardDescription>Create new indexes or delete existing ones</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Selection - Toggle Buttons */}
          <div className="space-y-2">
            <Label>Choose Action</Label>
            <p className="text-sm text-muted-foreground">Select what you want to do with indexes</p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={() => {
                  setActionMode('create');
                  setCreatedIndexName(null);
                  setSelectedIndex(null);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  actionMode === 'create'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FolderPlus className={`h-5 w-5 ${actionMode === 'create' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium">Create New Index</span>
                </div>
                <p className="text-sm text-muted-foreground">Create a new index to organize your documents</p>
              </button>
              <button
                onClick={() => {
                  if (hasIndexes) {
                    setActionMode('delete');
                    setCreatedIndexName(null);
                    setSelectedIndex(null);
                  }
                }}
                disabled={!hasIndexes}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  !hasIndexes
                    ? 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
                    : actionMode === 'delete'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Trash2 className={`h-5 w-5 ${actionMode === 'delete' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className="font-medium">Delete Index</span>
                </div>
                <p className="text-sm text-muted-foreground">Permanently remove an existing index and all its data</p>
              </button>
            </div>
          </div>

          {/* Create Index Mode */}
          {actionMode === 'create' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="index-name">Index Name</Label>
                <p className="text-sm text-muted-foreground">
                  A unique name for your new index (letters, numbers, underscores, hyphens)
                </p>
                <div className="flex gap-3">
                  <Input
                    id="index-name"
                    value={newIndexName}
                    onChange={(e) => setNewIndexName(e.target.value)}
                    placeholder="my-knowledge-base"
                    disabled={isCreatingIndex}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newIndexName && isValidIndexName && !isCreatingIndex) {
                        handleCreateIndex();
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateIndex}
                    disabled={!newIndexName || !isValidIndexName || isCreatingIndex}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingIndex ? 'Creating...' : 'Create Index'}
                  </Button>
                </div>
                {indexNameError && <p className="text-sm text-destructive">{indexNameError}</p>}
                <p className="text-xs text-muted-foreground">Must start with a letter</p>
              </div>

              {createdIndexName && (
                <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-800 dark:text-emerald-200">Success!</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>Index <strong>{createdIndexName}</strong> created successfully!</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateToAddKnowledge(createdIndexName)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Add Knowledge
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Delete Index Mode */}
          {actionMode === 'delete' && (
            <div className="space-y-4 pt-4 border-t">
              <IndexSelector
                selectedIndex={selectedIndex}
                onIndexChange={setSelectedIndex}
                refreshTrigger={indexRefreshTrigger}
                label="Select Index to Delete"
                description="Choose the index you want to permanently remove"
                disabled={isDeletingIndex}
              />

              {selectedIndex && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: This action cannot be undone</AlertTitle>
                  <AlertDescription>
                    Deleting an index will permanently remove all documents and embeddings stored in it.
                    Make sure you have backed up any important data before proceeding.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                variant="destructive"
                onClick={handleShowDeleteConfirm}
                disabled={!selectedIndex || isDeletingIndex}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingIndex ? 'Deleting...' : 'Delete Index'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Index Deletion
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete an index
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Index Name</p>
                <p className="font-medium text-destructive">{selectedIndex}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Records to Delete</p>
                <p className="font-medium">
                  {deleteIndexRecordCount !== null ? `${deleteIndexRecordCount.toLocaleString()} chunks` : '—'}
                </p>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                All documents, chunks, and embeddings in this index will be permanently deleted.
                This data cannot be recovered.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteIndex} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Index
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
