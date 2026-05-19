import React, { useState, useRef, useCallback } from 'react';
import * as Papa from 'papaparse';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';

interface ImportLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    session: any; // AuthSession — needed for Bearer token
}

// ── Fixed Template Headers (these are the EXACT columns the backend accepts) ──
const TEMPLATE_HEADERS = ['Name', 'Phone', 'Email', 'Company', 'Role', 'Source', 'Status', 'Score', 'Deal Value'];
const TEMPLATE_SAMPLE_ROW = ['Rahul Sharma', '919876543210', 'rahul@example.com', 'Acme Corp', 'CEO', 'Referrals', 'New', 'Warm', '50000'];
const VALID_SOURCES  = ['Manual', 'WhatsApp', 'Meta Ads', 'Referrals', 'Import', 'LinkedIn', 'Website'];
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const VALID_SCORES   = ['Cold', 'Warm', 'Hot'];

export const ImportLeadsModal = ({ isOpen, onClose, onSuccess, session }: ImportLeadsModalProps) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ inserted: number; skipped: number; errors?: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleClose = () => {
        setStep('upload');
        setParsedRows([]);
        setHeaders([]);
        setError(null);
        setResult(null);
        onClose();
    };

    // ── Download fixed-format template ──────────────────────────────────────
    const downloadTemplate = () => {
        const notes = [
            `# SalesAI Leads Import Template`,
            `# ------------------------------------`,
            `# Source ke valid values: ${VALID_SOURCES.join(' | ')}`,
            `# Status ke valid values: ${VALID_STATUSES.join(' | ')}`,
            `# Score ke valid values: ${VALID_SCORES.join(' | ')}`,
            `# Phone: country code ke saath pure digits (e.g. 919876543210 for India)`,
            `# Deal Value: sirf number (e.g. 50000)`,
        ].join('\n');

        const csv = notes + '\n' + TEMPLATE_HEADERS.join(',') + '\n' + TEMPLATE_SAMPLE_ROW.join(',');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'salesai_leads_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Parse CSV file ───────────────────────────────────────────────────────
    const processFile = (file: File) => {
        setError(null);
        if (!file.name.match(/\.(csv)$/i)) {
            setError('Sirf .csv file upload karein. Excel file ko "Save As → CSV" karke save karein phir upload karein.');
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    setError('File mein koi data nahi mila. Kripya template use karein.');
                    return;
                }
                const detectedHeaders = results.meta.fields || [];
                setHeaders(detectedHeaders);
                setParsedRows(results.data as any[]);
                setStep('preview');
            },
            error: (err) => setError(`File padhne mein error: ${err.message}`)
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    // ── Send rows to BACKEND for validation + insert ─────────────────────────
    const handleImport = async () => {
        if (!session?.token) {
            setError('Login session expired. Kripya page refresh karein.');
            return;
        }

        setLoading(true);
        setError(null);

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

            setResult({ inserted: json.inserted, skipped: json.skipped, errors: json.validationErrors });
            setStep('done');

            // Refresh parent list after 2 seconds
            setTimeout(() => {
                onSuccess();
                handleClose();
            }, 2500);

        } catch (err: any) {
            setError(err.message || 'Import failed. Backend se connect nahi ho paya.');
        } finally {
            setLoading(false);
        }
    };

    // Removed pill function to prevent React map argument issues

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100/50 bg-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center">
                            <Upload className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Bulk Import Leads</h2>
                            <p className="text-xs text-slate-400 font-medium">CSV file se 100+ leads ek sath add karein</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-300 hover:rotate-90">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 overflow-y-auto space-y-5">

                    {/* ── STEP 1: Upload ── */}
                    {step === 'upload' && (
                        <>
                            {/* Template Section */}
                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-indigo-800">Step 1: Template download karein</p>
                                        <p className="text-xs text-indigo-500 mt-0.5">Sahi format mein data bhar ke wapas upload karein.</p>
                                    </div>
                                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-100 transition-all shadow-sm whitespace-nowrap">
                                        <Download className="w-3.5 h-3.5" />
                                        Template (.csv)
                                    </button>
                                </div>

                                {/* Valid values reference */}
                                <div className="bg-white rounded-xl border border-indigo-100 p-3 space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Allowed Values (exact likhein):</p>
                                    <div className="space-y-1.5">
                                        <div className="flex gap-2 flex-wrap items-center">
                                            <span className="text-[10px] font-bold text-slate-500 w-14">Source:</span>
                                            {VALID_SOURCES.map(v => (
                                                <span key={v} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">{v}</span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 flex-wrap items-center">
                                            <span className="text-[10px] font-bold text-slate-500 w-14">Status:</span>
                                            {VALID_STATUSES.map(v => (
                                                <span key={v} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">{v}</span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 flex-wrap items-center">
                                            <span className="text-[10px] font-bold text-slate-500 w-14">Score:</span>
                                            {VALID_SCORES.map(v => (
                                                <span key={v} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">{v}</span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 flex-wrap items-center">
                                            <span className="text-[10px] font-bold text-slate-500 w-14">Phone:</span>
                                            <span className="text-[10px] text-slate-500 font-medium">Country code ke saath pure digits: <code className="bg-slate-100 px-1 rounded">919876543210</code></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'}`}
                            >
                                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="font-bold text-slate-700">CSV file yahan drop karein</p>
                                <p className="text-slate-400 text-sm mt-1">ya click karke select karein</p>
                                <span className="inline-block mt-4 px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                                    Browse File
                                </span>
                                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                            </div>
                        </>
                    )}

                    {/* ── STEP 2: Preview ── */}
                    {step === 'preview' && (
                        <>
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-emerald-700">{parsedRows.length} rows detected</span>
                                <span className="text-slate-400">— columns: {headers.join(', ')}</span>
                            </div>

                            {/* Preview Table (first 5 rows) */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-3 py-2.5 text-left text-[10px]">#</th>
                                            {headers.slice(0, 6).map(h => (
                                                <th key={h} className="px-3 py-2.5 text-left text-[10px]">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {parsedRows.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                                                {headers.slice(0, 6).map(h => (
                                                    <td key={h} className="px-3 py-2.5 text-slate-600 max-w-[100px] truncate">{row[h] || '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedRows.length > 5 && (
                                    <div className="text-center py-2 text-xs text-slate-400 font-medium border-t border-slate-100">
                                        + {parsedRows.length - 5} more rows (not shown)
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-medium">
                                ⚠️ Backend validation karega — galat Status/Score/Source ko automatically "New / Cold / Import" mein set kar dega.
                            </div>
                        </>
                    )}

                    {/* ── STEP 3: Done ── */}
                    {step === 'done' && result && (
                        <div className="flex flex-col items-center py-10 gap-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
                                <CheckCircle className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">Import Successful!</h3>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="text-3xl font-black text-emerald-600">{result.inserted}</p>
                                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Inserted</p>
                                </div>
                                {result.skipped > 0 && (
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-amber-500">{result.skipped}</p>
                                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Skipped</p>
                                    </div>
                                )}
                            </div>
                            {result.errors && result.errors.length > 0 && (
                                <div className="w-full p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 space-y-1">
                                    {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-sm font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step !== 'done' && (
                    <div className="p-6 border-t border-slate-100/50 bg-white/50">
                        <div className="flex gap-4">
                            <button onClick={step === 'preview' ? () => setStep('upload') : handleClose}
                                className="flex-1 py-3.5 bg-slate-50 border border-slate-200/60 text-slate-600 font-bold rounded-xl hover:bg-slate-100 hover:-translate-y-0.5 transition-all duration-300">
                                {step === 'preview' ? '← Back' : 'Cancel'}
                            </button>
                            {step === 'preview' && (
                                <button onClick={handleImport} disabled={loading}
                                    className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
                                    {loading
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                                        : `Import ${parsedRows.length} Leads →`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
