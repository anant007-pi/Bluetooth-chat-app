import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Trash2,
  Copy,
  Check,
  Send,
  Sliders,
  Download,
} from 'lucide-react';
import { TerminalLogEntry, BluetoothDeviceItem } from '../types';

interface TerminalViewProps {
  logs: TerminalLogEntry[];
  connectedDevice: BluetoothDeviceItem | null;
  onSendCommand: (cmd: string) => void;
  onClearLogs: () => void;
  delimiter: '\\n' | '\\r\\n' | 'none';
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  connectedDevice,
  onSendCommand,
  onClearLogs,
  delimiter,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [displayFormat, setDisplayFormat] = useState<'both' | 'ascii' | 'hex'>('both');
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    onSendCommand(commandInput.trim());
    setCommandInput('');
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString().slice(11, 23)}] [${l.direction}] ${l.text} | HEX: ${l.hex}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExportTxt = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toISOString()}] [${l.direction}] ${l.text}\n  HEX: ${l.hex}`
      )
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bluetooth_chat_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalTxBytes = logs.filter((l) => l.direction === 'TX').reduce((acc, l) => acc + l.bytes, 0);
  const totalRxBytes = logs.filter((l) => l.direction === 'RX').reduce((acc, l) => acc + l.bytes, 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 font-mono text-xs overflow-hidden">
      {/* Terminal Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">BLE / RFCOMM Raw Serial Monitor</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
            <span>
              TX: <strong className="text-cyan-400">{totalTxBytes} B</strong>
            </span>
            <span>•</span>
            <span>
              RX: <strong className="text-emerald-400">{totalRxBytes} B</strong>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Display format selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px]">
            <button
              onClick={() => setDisplayFormat('both')}
              className={`px-2 py-0.5 rounded ${
                displayFormat === 'both' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ASCII + HEX
            </button>
            <button
              onClick={() => setDisplayFormat('ascii')}
              className={`px-2 py-0.5 rounded ${
                displayFormat === 'ascii' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ASCII
            </button>
            <button
              onClick={() => setDisplayFormat('hex')}
              className={`px-2 py-0.5 rounded ${
                displayFormat === 'hex' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              HEX
            </button>
          </div>

          {/* Auto Scroll Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
            />
            <span className="hidden sm:inline">Autoscroll</span>
          </label>

          {/* Copy Log */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy Terminal Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export text */}
          <button
            onClick={handleExportTxt}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Download Log as .txt"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-black/70 text-slate-200 selection:bg-blue-600 selection:text-white">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic text-center py-12">
            No Bluetooth serial packets exchanged yet. Send a message or command to observe raw byte streams.
          </div>
        ) : (
          logs.map((log) => {
            const timeStr = new Date(log.timestamp).toTimeString().slice(0, 8) + '.' + String(log.timestamp % 1000).padStart(3, '0');

            if (log.direction === 'SYS') {
              return (
                <div key={log.id} className="text-amber-400/90 py-0.5 flex items-start gap-2 text-[11px]">
                  <span className="text-slate-600">[{timeStr}]</span>
                  <span className="font-bold text-amber-500">[SYS]</span>
                  <span className="flex-1">{log.text}</span>
                </div>
              );
            }

            const isTx = log.direction === 'TX';

            return (
              <div
                key={log.id}
                className={`py-1 px-2 rounded flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 ${
                  isTx ? 'bg-cyan-950/20 text-cyan-200' : 'bg-emerald-950/20 text-emerald-200'
                }`}
              >
                {/* Meta header */}
                <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                  <span className="text-slate-500">[{timeStr}]</span>
                  {isTx ? (
                    <span className="flex items-center gap-0.5 text-cyan-400 font-bold">
                      <ArrowUpRight className="w-3 h-3" />
                      [TX]
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                      <ArrowDownLeft className="w-3 h-3" />
                      [RX]
                    </span>
                  )}
                  <span className="text-slate-500 text-[10px]">({log.bytes}B)</span>
                </div>

                {/* Content Payload */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  {(displayFormat === 'both' || displayFormat === 'ascii') && (
                    <div className="break-all font-mono text-slate-100">{log.text}</div>
                  )}
                  {(displayFormat === 'both' || displayFormat === 'hex') && log.hex && (
                    <div className="text-[10px] text-slate-400 font-mono tracking-wider break-all selection:bg-emerald-800">
                      HEX: {log.hex}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Direct Command Send Bar */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <div className="flex items-center gap-1 text-slate-400 bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700 text-xs">
          <span>&gt;</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder={
              connectedDevice ? `Send serial command to ${connectedDevice.name}...` : 'Connect to a device first'
            }
            disabled={!connectedDevice}
            className="bg-transparent text-white focus:outline-none w-48 sm:w-80 placeholder-slate-500"
          />
        </div>

        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          Append: {delimiter}
        </span>

        <button
          type="submit"
          disabled={!commandInput.trim() || !connectedDevice}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Command</span>
        </button>
      </form>
    </div>
  );
};
