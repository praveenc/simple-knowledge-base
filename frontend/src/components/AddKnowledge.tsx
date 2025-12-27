/**
 * AddKnowledge Component
 * Page for adding documents to the knowledge base
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FolderOpen, Link, FileText, ChevronDown, Info, X, CheckCircle2, AlertCircle, Loader2, FilePlus } from 'lucide-react';
import { IndexSelector } from './IndexSelector';
import { uploadDocument, encodeBatch, getIndexRecordCount, ingestLLMSTxt } from '../api/client';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];

function validateFileExtension(fileName: string): string | null {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return ALLOWED_EXTENSIONS.includes(ext) ? null : `Unsupported file type. Only ${ALLOWED_EXTENSIONS.join(', ')} allowed.`;
}

interface AddKnowledgeProps {
    onNotification: (type: 'success' | 'error' | 'warning' | 'info' | 'in-progress', header: string, content?: ReactNode, options?: { id?: string }) => string;
    onRemoveNotification: (id: string) => void;
    preSelectedIndex?: string | null;
    onClearPreSelectedIndex?: () => void;
}

export function AddKnowledge({ onNotification, onRemoveNotification, preSelectedIndex, onClearPreSelectedIndex }: AddKnowledgeProps) {
    const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<string | null>(preSelectedIndex ?? null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isEncodingDoc, setIsEncodingDoc] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadResult, setUploadResult] = useState<{ filename: string; chunkCount: number } | null>(null);
    const [directoryPath, setDirectoryPath] = useState('');
    const filePatterns = useRef(['*.md', '*.txt']).current;
    const [isEncodingBatch, setIsEncodingBatch] = useState(false);
    const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
    const [batchStarted, setBatchStarted] = useState(false);
    const [preProcessRecordCount, setPreProcessRecordCount] = useState<number | null>(null);
    const [encodeMode, setEncodeMode] = useState<'single' | 'batch' | 'llms-txt'>('single');
    const [llmsTxtUrl, setLlmsTxtUrl] = useState('');
    const [isIngestingLlmsTxt, setIsIngestingLlmsTxt] = useState(false);
    const [showLlmsTxtConfirmModal, setShowLlmsTxtConfirmModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => { if (preSelectedIndex) setSelectedIndex(preSelectedIndex); }, [preSelectedIndex]);
    useEffect(() => { return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); }; }, []);

    const handleIndexChange = useCallback((indexName: string | null) => {
        setSelectedIndex(indexName);
        if (onClearPreSelectedIndex && indexName !== preSelectedIndex) onClearPreSelectedIndex();
    }, [preSelectedIndex, onClearPreSelectedIndex]);

    const handleUploadDocument = useCallback(async () => {
        if (!selectedIndex || !uploadedFile) return;
        const error = validateFileExtension(uploadedFile.name);
        if (error) { onNotification('error', 'Invalid file', error); return; }
        setIsEncodingDoc(true); setUploadProgress('uploading'); setUploadResult(null);
        try {
            const response = await uploadDocument(uploadedFile, selectedIndex);
            setUploadProgress('success');
            setUploadResult({ filename: response.filename, chunkCount: response.chunk_count });
            onNotification('success', 'Document encoded', `${response.chunk_count} chunks created`);
            setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIndexRefreshTrigger(p => p + 1);
        } catch (err) {
            setUploadProgress('error');
            onNotification('error', 'Upload failed', err instanceof Error ? err.message : 'Unknown error');
        } finally { setIsEncodingDoc(false); }
    }, [selectedIndex, uploadedFile, onNotification]);

    const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setUploadedFile(e.target.files?.[0] || null); setUploadProgress('idle'); setUploadResult(null);
    }, []);

    const handleEncodeBatch = useCallback(async () => {
        if (!selectedIndex || !directoryPath) return;
        const initialCount = preProcessRecordCount ?? 0;
        const notificationId = `batch-${Date.now()}`;
        let lastCount = initialCount, stablePolls = 0;
        setIsEncodingBatch(true);
        try {
            const response = await encodeBatch({ index_name: selectedIndex, directory_path: directoryPath, file_patterns: filePatterns });
            onNotification('in-progress', 'Batch processing', `Processing ${response.documents_queued ?? 0} documents...`, { id: notificationId });
            setDirectoryPath(''); setBatchStarted(true); setIsEncodingBatch(false);
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const { record_count } = await getIndexRecordCount(selectedIndex);
                    const added = record_count - initialCount;
                    onNotification('in-progress', 'Batch processing', `Added ${added} chunks (${record_count} total)`, { id: notificationId });
                    if (record_count === lastCount && added > 0) { stablePolls++; if (stablePolls >= 2) { clearInterval(pollingIntervalRef.current!); pollingIntervalRef.current = null; onRemoveNotification(notificationId); onNotification('success', 'Batch complete', `Added ${added} chunks`); setIndexRefreshTrigger(p => p + 1); } }
                    else { stablePolls = 0; lastCount = record_count; }
                } catch { /* ignore */ }
            }, 3000);
        } catch (err) { onNotification('error', 'Batch failed', err instanceof Error ? err.message : 'Error'); setIsEncodingBatch(false); }
    }, [selectedIndex, directoryPath, filePatterns, preProcessRecordCount, onNotification, onRemoveNotification]);

    const handleShowBatchConfirm = useCallback(async () => {
        if (selectedIndex) try { setPreProcessRecordCount((await getIndexRecordCount(selectedIndex)).record_count); } catch { setPreProcessRecordCount(null); }
        setShowBatchConfirmModal(true);
    }, [selectedIndex]);

    const handleShowLlmsTxtConfirm = useCallback(async () => {
        if (selectedIndex) try { setPreProcessRecordCount((await getIndexRecordCount(selectedIndex)).record_count); } catch { setPreProcessRecordCount(null); }
        setShowLlmsTxtConfirmModal(true);
    }, [selectedIndex]);

    const handleIngestLlmsTxt = useCallback(async () => {
        if (!selectedIndex || !llmsTxtUrl) return;
        const initialCount = preProcessRecordCount ?? 0;
        const notificationId = `llms-${Date.now()}`;
        let lastCount = initialCount, stablePolls = 0;
        setIsIngestingLlmsTxt(true);
        try {
            const response = await ingestLLMSTxt({ llms_txt_url: llmsTxtUrl, index_name: selectedIndex });
            onNotification('in-progress', 'Ingesting llms.txt', `Processing ${response.documents_queued} files...`, { id: notificationId });
            setLlmsTxtUrl(''); setIsIngestingLlmsTxt(false);
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const { record_count } = await getIndexRecordCount(selectedIndex);
                    const added = record_count - initialCount;
                    onNotification('in-progress', 'Ingesting llms.txt', `Added ${added} chunks`, { id: notificationId });
                    if (record_count === lastCount && added > 0) { stablePolls++; if (stablePolls >= 2) { clearInterval(pollingIntervalRef.current!); pollingIntervalRef.current = null; onRemoveNotification(notificationId); onNotification('success', 'Ingestion complete', `Added ${added} chunks`); setIndexRefreshTrigger(p => p + 1); } }
                    else { stablePolls = 0; lastCount = record_count; }
                } catch { /* ignore */ }
            }, 3000);
        } catch (err) { onNotification('error', 'Ingestion failed', err instanceof Error ? err.message : 'Error'); setIsIngestingLlmsTxt(false); }
    }, [selectedIndex, llmsTxtUrl, preProcessRecordCount, onNotification, onRemoveNotification]);

    const isValidUrl = (url: string) => { try { const p = new URL(url); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; } };

    return (
        <div className="space-y-6">
            <Collapsible>
                <Card>
                    <CollapsibleTrigger className="w-full">
                        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">How it works</CardTitle><ChevronDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><p className="font-medium text-sm mb-1">1. Select Index</p><p className="text-sm text-muted-foreground">Choose an existing index or create one in Manage Indexes.</p></div>
                                <div><p className="font-medium text-sm mb-1">2. Add Documents</p><p className="text-sm text-muted-foreground">Documents are chunked, embedded, and stored for semantic search.</p></div>
                                <div><p className="font-medium text-sm mb-1">3. Search</p><p className="text-sm text-muted-foreground">Use natural language queries. Results ranked by similarity.</p></div>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg"><FilePlus className="h-5 w-5 text-white" /></div>
                        <div><CardTitle>Add Knowledge</CardTitle><CardDescription>Add documents to your knowledge base</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <IndexSelector selectedIndex={selectedIndex} onIndexChange={handleIndexChange} refreshTrigger={indexRefreshTrigger} label="Step 1: Select Index" description="Choose the index to add documents to" />
                    {!selectedIndex && <Alert><Info className="h-4 w-4" /><AlertDescription>Select an index above. Create one in Manage Indexes if needed.</AlertDescription></Alert>}
                    {selectedIndex && (
                        <div className="pt-4 border-t space-y-6">
                            <div className="flex items-center gap-2"><span className="font-medium">Step 2: Add Documents to</span><span className="text-primary font-semibold">{selectedIndex}</span></div>
                            <div className="space-y-2">
                                <Label>Document Source</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {([['single', 'Single Document', 'Upload a single file', FileText], ['batch', 'Batch Directory', 'Process .md/.txt from directory', FolderOpen], ['llms-txt', 'llms.txt URL', 'Ingest from documentation site', Link]] as const).map(([value, label, desc, Icon]) => (
                                        <button key={value} onClick={() => setEncodeMode(value)} className={`p-4 rounded-lg border-2 text-left transition-all ${encodeMode === value ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'}`}>
                                            <div className="flex items-center gap-2 mb-1"><Icon className={`h-4 w-4 ${encodeMode === value ? 'text-primary' : 'text-muted-foreground'}`} /><span className="font-medium text-sm">{label}</span></div>
                                            <p className="text-xs text-muted-foreground">{desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {encodeMode === 'single' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select Document</Label>
                                        <div className="flex items-center gap-3">
                                            <Input ref={fileInputRef} type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={handleFileChange} className="flex-1" />
                                            {uploadedFile && <Button variant="ghost" size="icon" onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X className="h-4 w-4" /></Button>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Supported: {ALLOWED_EXTENSIONS.join(', ')}</p>
                                    </div>
                                    <Button onClick={handleUploadDocument} disabled={!uploadedFile || uploadProgress === 'uploading'} className="gap-2">
                                        {isEncodingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isEncodingDoc ? 'Uploading...' : 'Upload & Encode'}
                                    </Button>
                                    {uploadProgress !== 'idle' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                {uploadProgress === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                                {uploadProgress === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                                {uploadProgress === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                <span className="text-sm font-medium">{uploadProgress === 'uploading' ? 'Processing...' : uploadProgress === 'success' ? 'Complete' : 'Failed'}</span>
                                            </div>
                                            <Progress value={uploadProgress === 'uploading' ? 50 : 100} className="h-2" />
                                            {uploadProgress === 'success' && uploadResult && <p className="text-sm text-muted-foreground">Created {uploadResult.chunkCount} chunks from "{uploadResult.filename}"</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                            {encodeMode === 'batch' && (
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label>Directory Path</Label><Input value={directoryPath} onChange={e => setDirectoryPath(e.target.value)} placeholder="/path/to/documents/" disabled={isEncodingBatch} /></div>
                                    {!batchStarted && <Alert><Info className="h-4 w-4" /><AlertTitle>Background Processing</AlertTitle><AlertDescription>Batch processing runs in the background.</AlertDescription></Alert>}
                                    <Button onClick={handleShowBatchConfirm} disabled={!directoryPath || isEncodingBatch} className="gap-2">{isEncodingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}{isEncodingBatch ? 'Starting...' : 'Start Batch Processing'}</Button>
                                </div>
                            )}
                            {encodeMode === 'llms-txt' && (
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label>llms.txt URL</Label><Input value={llmsTxtUrl} onChange={e => setLlmsTxtUrl(e.target.value)} placeholder="https://docs.example.com/llms.txt" type="url" disabled={isIngestingLlmsTxt} /><p className="text-xs text-muted-foreground">Example: https://docs.anthropic.com/llms.txt</p></div>
                                    <Alert><Info className="h-4 w-4" /><AlertTitle>How it works</AlertTitle><AlertDescription>Downloads and indexes all markdown files referenced in the llms.txt.</AlertDescription></Alert>
                                    <Button onClick={handleShowLlmsTxtConfirm} disabled={!isValidUrl(llmsTxtUrl) || isIngestingLlmsTxt} className="gap-2">{isIngestingLlmsTxt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}{isIngestingLlmsTxt ? 'Starting...' : 'Ingest from URL'}</Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={showBatchConfirmModal} onOpenChange={setShowBatchConfirmModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Confirm Batch Processing</DialogTitle><DialogDescription>Review settings before starting:</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Target Index</p><p className="font-medium">{selectedIndex}</p></div><div><p className="text-sm text-muted-foreground">Current Records</p><p className="font-medium">{preProcessRecordCount?.toLocaleString() ?? '—'}</p></div></div>
                        <div><p className="text-sm text-muted-foreground">Directory</p><code className="text-sm bg-muted px-2 py-1 rounded">{directoryPath}</code></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowBatchConfirmModal(false)}>Cancel</Button><Button onClick={() => { setShowBatchConfirmModal(false); handleEncodeBatch(); }}>Start</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showLlmsTxtConfirmModal} onOpenChange={setShowLlmsTxtConfirmModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Confirm llms.txt Ingestion</DialogTitle><DialogDescription>Review settings before starting:</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Target Index</p><p className="font-medium">{selectedIndex}</p></div><div><p className="text-sm text-muted-foreground">Current Records</p><p className="font-medium">{preProcessRecordCount?.toLocaleString() ?? '—'}</p></div></div>
                        <div><p className="text-sm text-muted-foreground">URL</p><code className="text-sm bg-muted px-2 py-1 rounded break-all">{llmsTxtUrl}</code></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowLlmsTxtConfirmModal(false)}>Cancel</Button><Button onClick={() => { setShowLlmsTxtConfirmModal(false); handleIngestLlmsTxt(); }}>Start</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
