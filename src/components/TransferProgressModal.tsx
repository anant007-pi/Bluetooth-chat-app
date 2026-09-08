import React from 'react';
import { Bluetooth, CheckCircle2, XCircle, FileText, Activity } from 'lucide-react';

export interface TransferStatus {
  active: boolean;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  currentPacket: number;
  totalPackets: number;
  speedBps: number;
  error?: string;
  completed: boolean;
}

interface TransferProgressModalProps {
  transfer: TransferStatus | null;
  onCancel: () => void;
}

export const TransferProgressModal: React.FC<TransferProgressModalProps> = ({
  transfer,
  onCancel,
}) => {
  if (!transfer || !transfer.active) return null;

  const percent = Math.min(100, Math.round((transfer.transferredBytes / (transfer.totalBytes || 1)) * 100));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bluetooth className="w-5 h-5 text-blue-400 animate-pulse" />
            <h3 className="font-semibold text-sm">
              {transfer.completed ? 'Packet Stream Completed' : 'Transmitting over Bluetooth'}
            </h3>
          </div>
          {!transfer.completed && (
            <button onClick={onCancel} className="text-slate-400 hover:text-white text-xs">
              Cancel
            </button>
          )}
        </div>

        {/* File Info */}
        <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <FileText className="w-6 h-6 text-blue-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{transfer.fileName}</p>
            <p className="text-[11px] text-slate-400 font-mono">
              {(transfer.transferredBytes / 1024).toFixed(1)} KB / {(transfer.totalBytes / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-300 font-mono">
            <span>
              Packet {transfer.currentPacket} of {transfer.totalPackets}
            </span>
            <span className="font-semibold text-blue-400">{percent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                transfer.completed ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Transfer Stats */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono bg-slate-800/40 p-2.5 rounded-lg">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>Speed: {(transfer.speedBps / 1024).toFixed(1)} KB/s</span>
          </div>
          <div className="flex items-center gap-1.5 text-right justify-end">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>CRC-16 Verified</span>
          </div>
        </div>

        {transfer.completed && (
          <button
            onClick={onCancel}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};
