import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Papa from 'papaparse';
import { X, Upload, Download, History, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { AuthSession } from '../../../utils/types';

interface DataActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    session: AuthSession;
    defaultTab?: 'import' | 'export' | 'history';
}

const TEMPLATE_HEADERS = ['Name', 'Phone', 'Email', 'Company', 'Role', 'Source', 'Status', 'Score', 'Deal Value'];
const TEMPLATE_SAMPLE_ROW = ['Rahul Sharma', '919876543210', 'rahul@example.com', 'Acme Corp', 'CEO', 'Referrals', 'New', 'Warm', '50000'];
const VALID_SOURCES  = ['Manual', 'WhatsApp', 'Meta Ads', 'Referrals', 'Import', 'LinkedIn', 'Website'];
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const VALID_SCORES   = ['Cold', 'Warm', 'Hot'];

export const DataActivityModal = ({ isOpen, onClose, onSuccess, session, defaultTab = 'import' }: DataActivityModalProps) => {
    const [activeTab, setActiveTab] = useState<'import' | 'export' | 'history'>(defaultTab);

    // Import State
    const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors?: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Export State
    const [exportTimeFilter, setExportTimeFilter] = useState('all');
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    // History State
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyError, setHistoryError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
            if (defaultTab === 'history') {
                fetchHistory();
            }
        } else {
            // Reset state
            setImportStep('upload');
            setParsedRows([]);
            setHeaders([]);
            setImportError(null);
            setImportResult(null);
            setExportError(null);
        }
    }, [isOpen, defaultTab]);

    // Handle fetching history automatically when tab is clicked
    useEffect(() => {
        if (activeTab === 'history' && isOpen && historyData.length === 0) {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        setHistoryError(null);
        try {
            const response = await fetch('http://localhost:3001/api/leads/history', {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            const json = await response.json();
            if (response.ok && json.success) {
                setHistoryData(json.history);
            } else {
                throw new Error(json.error || 'Failed to load history');
            }
        } catch (err: any) {
            setHistoryError(err.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    const downloadTemplate = () => {
        const notes = [
            `# SalesAI Leads Import Template`,
            `# ------------------------------------`,
            `# Source ke valid values: ${VALID_SOURCES.join(' | ')}`,
            `# Status ke valid values: ${VALID_STATUSES.join(' | ')}`,
            `# Score ke valid values: ${VALID_SCORES.join(' | ')}`,
            `# Phone: country code ke saath pure digits (e.g. 919876543210 for India)`,
            `# Deal Value: sirf number (e.g. 50000)`,
        ].join('\\n');

        const csv = notes + '\\n' + TEMPLATE_HEADERS.join(',') + '\\n' + TEMPLATE_SAMPLE_ROW.join(',');
        const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'salesai_leads_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const processFile = (file: File) => {
        setImportError(null);
        if (!file.name.match(/\\.(csv)$/i)) {
            setImportError('Sirf .csv file upload karein. Excel file ko "Save As → CSV" karke save karein phir upload karein.');
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            comments: "#",
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    setImportError('File mein koi data nahi mila. Kripya template use karein.');
                    return;
                }
                const detectedHeaders = results.meta.fields || [];
                setHeaders(detectedHeaders);
                setParsedRows(results.data as any[]);
                setImportStep('preview');
            },
            error: (err) => setImportError(`File padhne mein error: ${err.message}`)
        });
    };

    const handleImport = async () => {
        if (!session?.token) {
            setImportError('Login session expired. Kripya page refresh karein.');
            return;
        }

        setImportLoading(true);
        setImportError(null);

        try {
            const response = await fetch('http://localhost:3001/api/leads/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.token}`
                },
                body: JSON.stringify({ rows: parsedRows })
            });

            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || `Server error: ${response.status}`);
            }

            setImportResult({ inserted: json.inserted, skipped: json.skipped, errors: json.validationErrors });
            setImportStep('done');

            // Refresh parent list and history tab after 2 seconds
            setTimeout(() => {
                onSuccess();
                fetchHistory();
            }, 2500);

        } catch (err: any) {
            setImportError(err.message || 'Import failed. Backend se connect nahi ho paya.');
        } finally {
            setImportLoading(false);
        }
    };

    const handleExport = async () => {
        if (!session?.token || exporting) return;
        setExporting(true);
        setExportError(null);
        try {
            const response = await fetch(`http://localhost:3001/api/leads/export?timeRange=${exportTimeFilter}`, {
                headers: { 'Authorization': `Bearer ${session.token}` }
            });
            
            if (response.ok) {
                const text = await response.text();
                const blob = new Blob([`\\uFEFF${text}`], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `leads_${exportTimeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                fetchHistory(); // Refresh history immediately
            } else {
                const errJson = await response.json().catch(() => ({}));
                setExportError(`Export failed: ${errJson.error || response.statusText}`);
            }
        } catch (err: any) {
            setExportError("Export network error. Is the backend running?");
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Data Activities
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6 shrink-0 bg-slate-50/50">
                    <button
                        onClick={() => setActiveTab('import')}
                        className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Upload className="w-4 h-4" /> Bulk Import
                    </button>
                    <button
                        onClick={() => setActiveTab('export')}
                        className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'export' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Download className="w-4 h-4" /> Data Export
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <History className="w-4 h-4" /> Activity History
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* --- IMPORT TAB --- */}
                    {activeTab === 'import' && (
                        <div className="space-y-6">
                            {importStep === 'upload' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 mb-1">Step 1: Download Template</h4>
                                            <p className="text-sm text-slate-600 mb-3">Download the standard CSV template. Apna data exact isi format me fill karein.</p>
                                            <button onClick={downloadTemplate} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all">
                                                Download Template (.csv)
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-3">Step 2: Upload Data</h4>
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDragging(false);
                                                if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
                                            }}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                                        >
                                            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
                                            <p className="font-bold text-slate-700">Click to upload or drag and drop</p>
                                            <p className="text-sm text-slate-500 mt-1">Only .csv files are supported</p>
                                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                                        </div>
                                    </div>
                                    {importError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> {importError}
                                        </div>
                                    )}
                                </div>
                            )}

                            {importStep === 'preview' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 text-lg">Preview Data</h3>
                                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-bold rounded-full">
                                            {parsedRows.length} rows found
                                        </span>
                                    </div>
                                    <div className="border rounded-xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                                                    <tr>
                                                        {headers.slice(0, 6).map(h => <th key={h} className="px-4 py-3 font-black tracking-wider border-b">{h}</th>)}
                                                        {headers.length > 6 && <th className="px-4 py-3 font-black tracking-wider border-b italic">...</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parsedRows.slice(0, 5).map((row, i) => (
                                                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50">
                                                            {headers.slice(0, 6).map(h => <td key={h} className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{row[h] || '-'}</td>)}
                                                            {headers.length > 6 && <td className="px-4 py-3 text-slate-400 italic">...</td>}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {importError && (
                                        <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> {importError}
                                        </div>
                                    )}
                                </div>
                            )}

                            {importStep === 'done' && importResult && (
                                <div className="flex flex-col items-center justify-center py-10 animate-fade-in text-center space-y-4">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800">Import Complete!</h3>
                                    <div className="flex gap-4 items-center mt-2">
                                        <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl text-center">
                                            <span className="block text-2xl font-black text-emerald-600">{importResult.inserted}</span>
                                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Inserted</span>
                                        </div>
                                        <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl text-center">
                                            <span className="block text-2xl font-black text-orange-600">{importResult.skipped}</span>
                                            <span className="text-xs font-bold text-orange-800 uppercase tracking-widest">Skipped</span>
                                        </div>
                                    </div>
                                    {importResult.errors && importResult.errors.length > 0 && (
                                        <div className="mt-6 w-full text-left bg-red-50 p-4 rounded-xl border border-red-100 max-h-40 overflow-y-auto text-sm text-red-600">
                                            <p className="font-bold mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Validation Errors:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- EXPORT TAB --- */}
                    {activeTab === 'export' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                                <h3 className="font-bold text-slate-800 mb-2">Filter Export Data</h3>
                                <p className="text-sm text-slate-600 mb-6">Select the time range for the leads you want to download.</p>
                                
                                <div className="space-y-3 mb-6">
                                    {[
                                        { id: 'all', label: 'All Time' },
                                        { id: 'year', label: 'This Year' },
                                        { id: 'month', label: 'This Month' },
                                        { id: 'week', label: 'This Week' }
                                    ].map(opt => (
                                        <label key={opt.id} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${exportTimeFilter === opt.id ? 'bg-white border-indigo-400 shadow-sm ring-1 ring-indigo-400' : 'bg-white/50 border-slate-200 hover:border-indigo-200 hover:bg-white'}`}>
                                            <input 
                                                type="radio" 
                                                name="timeFilter" 
                                                value={opt.id} 
                                                checked={exportTimeFilter === opt.id} 
                                                onChange={(e) => setExportTimeFilter(e.target.value)} 
                                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                                            />
                                            <span className="ml-3 font-semibold text-slate-800">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>

                                {exportError && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> {exportError}
                                    </div>
                                )}

                                <button 
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {exporting ? <><Loader2 className="w-5 h-5 animate-spin" /> Exporting...</> : <><Download className="w-5 h-5" /> Download CSV</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- HISTORY TAB --- */}
                    {activeTab === 'history' && (
                        <div className="animate-fade-in">
                            {historyLoading ? (
                                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                            ) : historyError ? (
                                <div className="p-4 bg-red-50 text-red-600 rounded-xl">{historyError}</div>
                            ) : historyData.length === 0 ? (
                                <div className="py-12 text-center text-slate-500">No import or export history found yet.</div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-4 py-3 font-black">Action</th>
                                                <th className="px-4 py-3 font-black">Records</th>
                                                <th className="px-4 py-3 font-black">Filter / Details</th>
                                                <th className="px-4 py-3 font-black text-right">Date & Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {historyData.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${log.action_type === 'IMPORT' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                            {log.action_type === 'IMPORT' ? <Upload className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                                            {log.action_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">
                                                        {log.record_count}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {log.action_type === 'IMPORT' ? (
                                                            log.skipped_count > 0 ? <span className="text-red-500 text-xs font-bold">({log.skipped_count} skipped)</span> : <span className="text-green-600 text-xs font-bold">All Valid</span>
                                                        ) : (
                                                            <span className="capitalize">{log.filter_type || 'all'} Time</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-500 text-xs font-medium">
                                                        {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer buttons (only for Import step) */}
                {activeTab === 'import' && importStep !== 'done' && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                        <button onClick={importStep === 'preview' ? () => setImportStep('upload') : onClose} disabled={importLoading} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                            {importStep === 'preview' ? 'Back' : 'Cancel'}
                        </button>
                        {importStep === 'preview' && (
                            <button onClick={handleImport} disabled={importLoading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2">
                                {importLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : 'Confirm Import'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
