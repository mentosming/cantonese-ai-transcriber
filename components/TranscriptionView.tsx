import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Copy, Download, FileText, Check, FileSpreadsheet, Trash2, Table as TableIcon, AlignLeft, CheckSquare, Square, Sparkles, ArrowRight, Upload, Captions } from 'lucide-react';
import Button from './Button';
import { Speaker } from '../types';

interface TranscriptionViewProps {
  text: string;
  status: string;
  speakers?: Speaker[]; // Added speakers prop for mapping
  onClear: () => void;
  onUpdate?: (newText: string) => void;
  onSwitchToSummary?: () => void;
  className?: string;
}

interface RowData {
    id: number;
    type: 'segment' | 'separator' | 'raw';
    time: string; 
    speaker: string;
    content: string;
    rawLine: string; 
}

// Time Helper Functions
const parseTimeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    
    // HH:MM:SS or MM:SS
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
};

const formatSecondsToTime = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');

    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
};

const formatSecondsToSRTTimestamp = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
};

const TranscriptionView: React.FC<TranscriptionViewProps> = ({ text, status, speakers, onClear, onUpdate, onSwitchToSummary, className }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'text'>('table');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Parse text into rows and apply timestamp offsets dynamically
  // Added 'speakers' to dependency array so it re-calculates when settings change
  const rows: RowData[] = useMemo(() => {
    const lines = text.split('\n');
    let currentOffsetSeconds = 0;

    return lines.map((line, index) => {
        const trimmed = line.trim();
        
        // 1. Check for Separator
        const separatorMatch = trimmed.match(/Start:\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (trimmed.startsWith('--- [') || trimmed.startsWith('--- [接續檔案')) {
             if (separatorMatch) {
                 currentOffsetSeconds = parseTimeToSeconds(separatorMatch[1]);
             }
             return { id: index, type: 'separator', time: '', speaker: '', content: trimmed.replace(/---/g, '').trim(), rawLine: line };
        }

        if (!trimmed) {
            return { id: index, type: 'raw', time: '', speaker: '', content: '', rawLine: line };
        }

        // 2. Check for Timestamped Segment
        const match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(?:(?:\*\*)?([^*:]+?)(?:\*\*)?:)?\s*(.*)/);
        
        if (match) {
            const rawStartTime = match[1];
            const rawEndTime = match[2];
            let speaker = match[3] || '';
            const content = match[4];

            // --- SPEAKER MAPPING LOGIC (NEW) ---
            // If the user defined "Speaker 1: Peter", and AI output "Speaker 1", we swap it here.
            if (speakers && speakers.length > 0) {
                // Case-insensitive check
                // Try to find if 'speaker' matches any ID (e.g. "Speaker 1")
                const mapped = speakers.find(s => s.id.toLowerCase() === speaker.toLowerCase());
                if (mapped) {
                    speaker = mapped.name;
                }
            }
            // -----------------------------------

            // Apply Offset
            const startSec = parseTimeToSeconds(rawStartTime) + currentOffsetSeconds;
            const newStartTime = formatSecondsToTime(startSec);
            
            let newTimeStr = newStartTime;
            let rawLineTimeStr = `[${newStartTime}]`;

            if (rawEndTime) {
                const endSec = parseTimeToSeconds(rawEndTime) + currentOffsetSeconds;
                const newEndTime = formatSecondsToTime(endSec);
                newTimeStr = `${newStartTime} - ${newEndTime}`;
                rawLineTimeStr = `[${newStartTime} - ${newEndTime}]`;
            }

            // Reconstruct the line with MAPPED speaker name
            const newRawLine = `${rawLineTimeStr} ${speaker ? speaker + ': ' : ''}${content}`;

            return {
                id: index,
                type: 'segment',
                time: newTimeStr,
                speaker: speaker,
                content: content,
                rawLine: newRawLine
            };
        }
        
        return { id: index, type: 'raw', time: '', speaker: '', content: line, rawLine: line };
    });
  }, [text, speakers]);

  // Auto-scroll logic
  useEffect(() => {
    if (status === 'transcribing') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [text, status, viewMode]);

  // Construct the full text from the Processed Rows
  const getProcessedText = () => {
      return rows.map(r => r.rawLine).join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getProcessedText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([getProcessedText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  };

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Time,Speaker,Content\n";
    
    rows.forEach(row => {
        if (row.type === 'segment') {
            csvContent += `"${row.time}","${row.speaker}","${row.content.replace(/"/g, '""')}"\n`;
        } else if (row.type === 'separator') {
             csvContent += `,,"${row.rawLine.replace(/"/g, '""')}"\n`;
        } else if (row.type === 'raw' && row.content.trim()) {
             csvContent += `,,"${row.content.replace(/"/g, '""')}"\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transcription_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSRT = () => {
    let srtContent = "";
    let counter = 1;

    rows.forEach(row => {
        if (row.type !== 'segment') return;

        const timeParts = row.time.split('-').map(t => t.trim());
        if (timeParts.length === 0 || !timeParts[0]) return;

        const startSec = parseTimeToSeconds(timeParts[0]);
        let endSec = timeParts[1] ? parseTimeToSeconds(timeParts[1]) : startSec + 5;
        if (endSec <= startSec) endSec = startSec + 3;

        srtContent += `${counter}\n`;
        srtContent += `${formatSecondsToSRTTimestamp(startSec)} --> ${formatSecondsToSRTTimestamp(endSec)}\n`;
        
        const text = row.speaker ? `${row.speaker}: ${row.content}` : row.content;
        srtContent += `${text}\n\n`;
        
        counter++;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().slice(0,10)}.srt`;
    a.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdate) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const rawText = event.target?.result as string;
        if (!rawText) return;

        let input = rawText;
        if (input.charCodeAt(0) === 0xFEFF) {
            input = input.slice(1);
        }

        const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        let importString = "";
        let validRowsCount = 0;

        const parseLine = (line: string): string[] => {
            const res: string[] = [];
            let cur = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (inQuote) {
                    if (c === '"') {
                        if (i + 1 < line.length && line[i + 1] === '"') {
                            cur += '"';
                            i++;
                        } else {
                            inQuote = false;
                        }
                    } else {
                        cur += c;
                    }
                } else {
                    if (c === '"') {
                        inQuote = true;
                    } else if (c === ',') {
                        res.push(cur);
                        cur = '';
                    } else {
                        cur += c;
                    }
                }
            }
            res.push(cur);
            return res;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (line.startsWith('---')) continue;

            const cols = parseLine(line);
            if (i < 5) {
                 const c0 = cols[0]?.toLowerCase().trim().replace(/^"|"$/g, '');
                 if (c0 === 'time' || c0 === '時間' || c0.startsWith('time')) continue;
            }

            let time = "";
            let speaker = "";
            let content = "";

            if (cols.length >= 3) {
                time = cols[0];
                speaker = cols[1];
                content = cols[2];
                if (cols.length > 3) content = cols.slice(2).join(',');
            } else if (cols.length === 2) {
                 time = cols[0];
                 content = cols[1];
            } else if (cols.length === 1) {
                 content = cols[0];
            }

            const cleanTime = time.trim();
            const cleanSpeaker = speaker.trim();
            const cleanContent = content.trim();

            if (cleanTime) {
                 const timeStr = cleanTime.startsWith('[') ? cleanTime : `[${cleanTime}]`;
                 importString += `${timeStr} ${cleanSpeaker ? cleanSpeaker + ': ' : ''}${cleanContent}\n`;
                 validRowsCount++;
            } else if (cleanContent) {
                 importString += `${cleanContent}\n`;
                 validRowsCount++;
            }
        }
        
        if (validRowsCount > 0) {
             if (window.confirm(`成功解析 ${validRowsCount} 行資料。確定導入嗎？(將覆蓋現有內容)`)) {
                 onUpdate(importString);
             }
        } else {
            alert("無法解析 CSV 檔案。");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateRow = (index: number, field: 'time' | 'speaker' | 'content', value: string) => {
    if (!onUpdate) return;
    
    const row = rows[index];
    if (row.type !== 'segment') {
         const lines = text.split('\n');
         lines[index] = value;
         onUpdate(lines.join('\n'));
         return;
    }

    const newSpeaker = field === 'speaker' ? value : row.speaker;
    const newContent = field === 'content' ? value : row.content;
    
    const lines = text.split('\n');
    const originalLine = lines[index];
    
    if (field === 'content' || field === 'speaker') {
         // When updating manually, we preserve the original timestamp structure from the raw text
         const timeMatch = originalLine.match(/^(\[.*?\])/);
         const originalTimestampPrefix = timeMatch ? timeMatch[1] : `[${row.time}]`;
         
         const spk = newSpeaker ? `${newSpeaker}: ` : '';
         lines[index] = `${originalTimestampPrefix} ${spk}${newContent}`;
    } else if (field === 'time') {
         // Logic to update time in raw text (complex due to offsets, simplifying to replace display time)
         // For now, this updates the display representation in raw text line
         const spk = newSpeaker ? `${newSpeaker}: ` : '';
         lines[index] = `[${value}] ${spk}${newContent}`;
    }

    onUpdate(lines.join('\n'));
  };

  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
        newSet.delete(index);
    } else {
        newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const toggleSelectAll = () => {
     if (selectedIndices.size === rows.length) {
         setSelectedIndices(new Set());
     } else {
         const allIndices = rows.map((_, i) => i);
         setSelectedIndices(new Set(allIndices));
     }
  };

  const handleDeleteSelected = () => {
      if (!onUpdate) return;
      if (window.confirm(`確定要刪除選取的 ${selectedIndices.size} 行嗎？`)) {
          const lines = text.split('\n');
          const newLines = lines.filter((_, idx) => !selectedIndices.has(idx));
          onUpdate(newLines.join('\n'));
          setSelectedIndices(new Set());
      }
  };

  const renderTable = () => {
    const tableRows: React.ReactNode[] = [];
    const isTranscribing = status === 'transcribing';

    rows.forEach((row, index) => {
        if (!row.content.trim() && row.type === 'raw') return;

        if (row.type === 'separator') {
            tableRows.push(
                <tr key={index} className="bg-blue-50 dark:bg-blue-900/30">
                    <td className="w-10 px-2 py-2 text-center border-b border-slate-100 dark:border-slate-700"></td>
                    <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-300 text-center border-b border-slate-100 dark:border-slate-700 font-mono">
                        {row.content}
                    </td>
                </tr>
            );
            return;
        }

        const isSelected = selectedIndices.has(index);

        tableRows.push(
            <tr key={index} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                <td className="px-2 py-3 align-top w-10 text-center">
                    {!isTranscribing && (
                        <button 
                            onClick={() => toggleSelect(index)}
                            className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            {isSelected ? <CheckSquare size={16} className="text-blue-600 dark:text-blue-400"/> : <Square size={16} />}
                        </button>
                    )}
                </td>
                <td className="px-2 py-2 align-top w-36">
                     {row.type === 'segment' ? (
                         <input 
                            type="text"
                            value={row.time}
                            disabled={isTranscribing}
                            onChange={(e) => updateRow(index, 'time', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-blue-300 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded px-1 py-0.5 text-xs font-mono text-slate-500 dark:text-slate-400 outline-none transition-all"
                         />
                     ) : null}
                </td>
                <td className="px-2 py-2 align-top w-28">
                    {row.type === 'segment' ? (
                        <input 
                            type="text"
                            value={row.speaker} // Mapped speaker name displayed here
                            disabled={isTranscribing}
                            onChange={(e) => updateRow(index, 'speaker', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-blue-300 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded px-1 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none transition-all"
                        />
                    ) : null}
                </td>
                <td className="px-2 py-2 align-top">
                    <textarea 
                        value={row.content}
                        disabled={isTranscribing}
                        onChange={(e) => updateRow(index, 'content', e.target.value)}
                        rows={1}
                        style={{ height: 'auto', minHeight: '1.5rem' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                        className="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-blue-300 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded px-1 py-0.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed outline-none resize-none overflow-hidden transition-all"
                    />
                </td>
            </tr>
        );
    });

    return (
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="px-2 py-2 w-10 text-center">
                         {!isTranscribing && (
                            <button onClick={toggleSelectAll} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                                {selectedIndices.size > 0 && selectedIndices.size === rows.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                            </button>
                         )}
                    </th>
                    <th className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 w-36">時間 (開始 - 結束)</th>
                    <th className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 w-28">說話者</th>
                    <th className="px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">內容 (點擊可編輯)</th>
                </tr>
            </thead>
            <tbody>
                {tableRows}
            </tbody>
        </table>
    );
  };

  const renderTextView = () => {
      return (
        <div className="p-6 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {getProcessedText()}
            <div ref={bottomRef} />
        </div>
      );
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col ${className || 'h-[650px]'}`}>
      <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
          <FileText size={20} className="text-blue-600 dark:text-blue-400" />
          結果
        </div>
        
        <div className="flex items-center gap-1 flex-wrap justify-end">
           {selectedIndices.size > 0 && viewMode === 'table' && (
                <Button 
                    variant="danger" 
                    onClick={handleDeleteSelected} 
                    className="text-xs h-8 px-2 mr-2 animate-fade-in"
                >
                    <Trash2 size={14} className="mr-1"/> 刪除 ({selectedIndices.size})
                </Button>
           )}

           <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mr-2">
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1 rounded flex items-center gap-1 text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <TableIcon size={14} /> 表格
              </button>
              <button 
                onClick={() => setViewMode('text')}
                className={`p-1 rounded flex items-center gap-1 text-xs font-medium transition-all ${viewMode === 'text' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <AlignLeft size={14} /> 純文字
              </button>
           </div>
           
           <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
           
           {onSwitchToSummary && (
               <Button 
                variant="ghost" 
                onClick={onSwitchToSummary} 
                className="text-xs h-8 px-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30" 
                title="轉至摘要面板"
               >
                 <Sparkles size={14} className="mr-1" /> 前往 AI 摘要 <ArrowRight size={14} className="ml-1"/>
               </Button>
           )}

           <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>

           <Button variant="ghost" onClick={onClear} className="text-xs h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" title="清空文字">
            <Trash2 size={14} />
          </Button>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
          
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".csv"
            onChange={handleImportCSV}
          />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 px-2 dark:text-slate-300 dark:hover:bg-slate-700" title="導入 CSV">
             <Upload size={14} /> 導入
          </Button>

          <Button variant="ghost" onClick={handleCopy} className="text-xs h-8 px-2 dark:text-slate-300 dark:hover:bg-slate-700">
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? "已複製" : "複製"}
          </Button>
          <Button variant="ghost" onClick={handleDownloadTxt} className="text-xs h-8 px-2 dark:text-slate-300 dark:hover:bg-slate-700" title="下載 .txt">
            <Download size={14} /> TXT
          </Button>
          <Button variant="ghost" onClick={handleDownloadSRT} className="text-xs h-8 px-2 dark:text-slate-300 dark:hover:bg-slate-700" title="下載 .srt (字幕檔)">
            <Captions size={14} /> SRT
          </Button>
           <Button variant="ghost" onClick={handleDownloadCSV} className="text-xs h-8 px-2 dark:text-slate-300 dark:hover:bg-slate-700" title="下載 .csv">
            <FileSpreadsheet size={14} /> CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 scrollbar-thin relative min-h-0">
        {!text ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-8 text-center">
            <TableIcon size={48} className="mb-4 opacity-20" />
            <p>轉錄內容將顯示於此...</p>
            <p className="text-xs mt-2 opacity-60">支援導入 CSV 檔案恢復編輯</p>
          </div>
        ) : (
            viewMode === 'text' ? (
                renderTextView()
            ) : (
                <div className="pb-4">
                    {renderTable()}
                    <div ref={bottomRef} />
                </div>
            )
        )}
      </div>
      
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-xs text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-between px-4 shrink-0">
        <span>字數統計: {getProcessedText().length}</span>
        {viewMode === 'table' && <span className="text-blue-600 dark:text-blue-400 hidden sm:inline">時間戳已自動校正 | 可點擊文字編輯</span>}
      </div>
    </div>
  );
};

export default TranscriptionView;