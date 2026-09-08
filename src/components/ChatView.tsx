import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bluetooth,
  Paperclip,
  Check,
  CheckCheck,
  Sparkles,
  Info,
  Clock,
  Terminal,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
  Smartphone,
  Flame,
  QrCode,
} from 'lucide-react';
import { BluetoothDeviceItem, BluetoothMessage, ConnectionState } from '../types';

interface ChatViewProps {
  messages: BluetoothMessage[];
  connectedDevice: BluetoothDeviceItem | null;
  connectionState: ConnectionState;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  onClearChat: () => void;
  onOpenScanner: () => void;
  onOpenPairPhone?: () => void;
  delimiter: '\\n' | '\\r\\n' | 'none';
  onQuickConnectVirtual: (type: 'phone' | 'esp32') => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  connectedDevice,
  connectionState,
  onSendMessage,
  onSendFile,
  onClearChat,
  onOpenScanner,
  onOpenPairPhone,
  delimiter,
  onQuickConnectVirtual,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedHexMessageId, setExpandedHexMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionState === 'connected' && connectedDevice !== null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Dynamic quick prompts based on peer device
  const isEsp32 = connectedDevice?.name.toLowerCase().includes('esp32') || connectedDevice?.type === 'terminal';

  const quickChips = isEsp32
    ? [
        { label: 'AT', cmd: 'AT' },
        { label: 'STATUS', cmd: 'STATUS' },
        { label: 'TEMP?', cmd: 'TEMP' },
        { label: 'LED ON', cmd: 'LED ON' },
        { label: 'LED OFF', cmd: 'LED OFF' },
        { label: 'HELP', cmd: 'HELP' },
      ]
    : [
        { label: 'Hello 👋', cmd: 'Hello there!' },
        { label: 'Ping ⚡', cmd: 'PING' },
        { label: 'How are you?', cmd: 'How are you doing today?' },
        { label: 'Check Signal 📶', cmd: 'Where are you nearby?' },
        { label: 'ACK 👍', cmd: 'ACK received OK' },
      ];

  const currentByteCount = new TextEncoder().encode(inputText).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Conversation Subheader */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-medium text-slate-200">
                Active Session: <strong className="text-white">{connectedDevice.name}</strong>
              </span>
              <span className="text-slate-400 hidden sm:inline">
                (MTU: {connectedDevice.mtu || 247} bytes | Delimiter: {delimiter === 'none' ? 'None' : delimiter})
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span className="text-slate-400">No active Bluetooth link</span>
            </>
          )}
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            title="Clear Chat Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {!isConnected && messages.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 mb-4 shadow-inner">
              <Bluetooth className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight mb-1">
              Bluetooth Chat Ready
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              Connect to a nearby Bluetooth device, a physical BLE peripheral, or another browser tab to start chatting
              over wireless packets.
            </p>

            <div className="w-full space-y-2.5">
              {onOpenPairPhone && (
                <button
                  id="btn-empty-pair-phone"
                  onClick={onOpenPairPhone}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white text-sm font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Pair Any Phone (QR / PIN Code)</span>
                </button>
              )}

              <button
                onClick={onOpenScanner}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl shadow-md transition-all"
              >
                <Bluetooth className="w-4 h-4 text-blue-400" />
                <span>Scan for BLE Peripherals</span>
              </button>

              <div className="flex items-center gap-2 pt-2">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or Quick Connect:</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onQuickConnectVirtual('phone')}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pixel 8 Pro (Chat)</span>
                </button>
                <button
                  onClick={() => onQuickConnectVirtual('esp32')}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>ESP32 Terminal</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 max-w-lg text-center">
                    <Info className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>{msg.text}</span>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            }

            const isMe = msg.sender === 'me';
            const isHexOpen = expandedHexMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-in fade-in duration-150`}
              >
                {/* Sender Name */}
                {!isMe && (
                  <span className="text-[11px] font-medium text-slate-400 ml-1 mb-0.5">
                    {msg.senderName || connectedDevice?.name || 'Peer Device'}
                  </span>
                )}

                {/* Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm relative transition-all ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-bl-xs'
                  }`}
                >
                  {/* Message Text */}
                  <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed selection:bg-blue-300 selection:text-blue-900">
                    {msg.text}
                  </p>

                  {/* File Attachment Card if present */}
                  {msg.fileAttachment && (
                    <div className="mt-2 p-2 rounded-lg bg-black/20 border border-white/10 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-blue-200" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{msg.fileAttachment.name}</p>
                        <p className="text-[10px] text-blue-200/80">
                          {(msg.fileAttachment.size / 1024).toFixed(1)} KB packet stream
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Metadata Row: Timestamp, Byte count, Hex toggle, Status */}
                  <div
                    className={`flex items-center gap-2 mt-1.5 text-[10px] font-mono ${
                      isMe ? 'text-blue-100/80 justify-end' : 'text-slate-400 justify-start'
                    }`}
                  >
                    <span>{msg.byteLength} bytes</span>
                    <span>•</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>

                    {/* Expand Hex Payload Button */}
                    {msg.rawHex && (
                      <button
                        onClick={() => setExpandedHexMessageId(isHexOpen ? null : msg.id)}
                        className={`hover:underline flex items-center gap-0.5 px-1 py-0.2 rounded transition-colors ${
                          isMe ? 'hover:bg-blue-700' : 'hover:bg-slate-700'
                        }`}
                        title="Inspect raw RFCOMM/BLE byte payload"
                      >
                        <span>HEX</span>
                        {isHexOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      </button>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={() => copyToClipboard(msg.text, msg.id)}
                      className={`hover:text-white p-0.5 rounded transition-colors ${
                        isMe ? 'hover:bg-blue-700' : 'hover:bg-slate-700'
                      }`}
                      title="Copy text"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>

                    {/* Delivery Status (for outgoing messages) */}
                    {isMe && (
                      <span className="ml-0.5">
                        {msg.status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-200 inline" title="Delivered via Bluetooth" />
                        ) : msg.status === 'sent' ? (
                          <Check className="w-3.5 h-3.5 text-blue-200 inline" title="Transmitted" />
                        ) : (
                          <Clock className="w-3 h-3 text-blue-300 animate-spin inline" title="Sending..." />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Expanded Hex View Drawer */}
                  {isHexOpen && msg.rawHex && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 text-[10px] font-mono">
                      <div className="flex items-center justify-between text-slate-300 mb-1">
                        <span className="uppercase text-[9px] font-semibold tracking-wider">Raw Payload (Hex)</span>
                        <button
                          onClick={() => copyToClipboard(msg.rawHex!, msg.id + '_hex')}
                          className="text-[9px] hover:underline"
                        >
                          {copiedId === msg.id + '_hex' ? 'Copied' : 'Copy Hex'}
                        </button>
                      </div>
                      <div className="p-2 rounded bg-black/40 text-emerald-400 font-mono text-[10px] break-all select-all">
                        {msg.rawHex}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      {isConnected && (
        <div className="px-3 py-1.5 bg-slate-900/50 border-t border-slate-800/60 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-400" />
            Quick:
          </span>
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(chip.cmd)}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 border border-slate-700/80 transition-colors font-mono"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-2.5 sm:p-3 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSend} className="max-w-6xl mx-auto flex items-end gap-2">
          {/* File Attachment simulation */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected}
            title="Send file / packet over Bluetooth"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text Input Area */}
          <div className="flex-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-colors">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
              placeholder={
                isConnected
                  ? `Message ${connectedDevice?.name || 'device'} (Press Enter to send)...`
                  : 'Connect to a Bluetooth device to start messaging...'
              }
              rows={1}
              className="w-full bg-transparent text-white text-xs sm:text-sm placeholder-slate-500 resize-none focus:outline-none min-h-[24px] max-h-[100px]"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-700/40">
              <span>
                {currentByteCount} byte{currentByteCount === 1 ? '' : 's'}
              </span>
              <span className="font-mono">
                Delimiter: {delimiter === 'none' ? 'None' : delimiter}
              </span>
            </div>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:pointer-events-none transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
