import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Smartphone,
  QrCode,
  KeyRound,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  Sparkles,
  Info,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Radio,
  Laptop,
} from 'lucide-react';
import { BluetoothDeviceItem } from '../types';
import { PhoneInfo } from '../utils/phoneDiagnostics';

interface PairAnyPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  localDeviceName: string;
  phoneInfo: PhoneInfo;
  currentRoomCode: string | null;
  connectionState?: string;
  connectedDevice?: BluetoothDeviceItem | null;
  onHostNewSession: (customCode?: string) => Promise<{ code: string }>;
  onJoinSession: (code: string) => Promise<void>;
  onConnectDevice: (device: BluetoothDeviceItem) => void;
  nearbyPhones: BluetoothDeviceItem[];
  onRefreshNearby: () => void;
  isRefreshingNearby: boolean;
}

export function getPublicPairUrl(code: string): string {
  if (typeof window === 'undefined') return '';
  let origin = window.location.origin;
  let pathname = window.location.pathname;

  // In AI Studio preview, ais-dev- is auth-restricted; ais-pre- is the public preview URL
  // that any smartphone camera can open without Google login!
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  return `${origin}${pathname}?pair=${encodeURIComponent(code)}`;
}

export const PairAnyPhoneModal: React.FC<PairAnyPhoneModalProps> = ({
  isOpen,
  onClose,
  localDeviceName,
  phoneInfo,
  currentRoomCode,
  connectionState,
  connectedDevice,
  onHostNewSession,
  onJoinSession,
  onConnectDevice,
  nearbyPhones,
  onRefreshNearby,
  isRefreshingNearby,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'code' | 'nearby' | 'diagnostics'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>(currentRoomCode || '');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Initialize or ensure room code exists
  useEffect(() => {
    if (!isOpen) return;

    if (currentRoomCode) {
      setRoomCode(currentRoomCode);
      generateQr(currentRoomCode);
    } else {
      handleCreateHostCode();
    }
  }, [isOpen, currentRoomCode]);

  const generateQr = async (code: string) => {
    try {
      const pairUrl = getPublicPairUrl(code);
      setJoinUrl(pairUrl);
      const url = await QRCode.toDataURL(pairUrl, {
        width: 340,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }
  };

  const handleCreateHostCode = async () => {
    setIsGenerating(true);
    try {
      const res = await onHostNewSession();
      setRoomCode(res.code);
      await generateQr(res.code);
    } catch (err) {
      console.error('Error creating host code', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      await onJoinSession(inputCode.trim().toUpperCase());
      onClose();
    } catch (err: any) {
      setJoinError(err.message || 'Could not connect to this phone code.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const pairUrl = joinUrl || getPublicPairUrl(roomCode);
    navigator.clipboard.writeText(pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenPeerTab = () => {
    if (typeof window === 'undefined') return;
    const pairUrl = joinUrl || getPublicPairUrl(roomCode);
    window.open(pairUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (typeof window === 'undefined' || !navigator.share) {
      handleCopyLink();
      return;
    }
    const pairUrl = joinUrl || getPublicPairUrl(roomCode);
    try {
      await navigator.share({
        title: 'Bluetooth Chat - Wireless Phone Link',
        text: `Connect to ${localDeviceName} on Bluetooth Chat! PIN: ${roomCode}`,
        url: pairUrl,
      });
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                  Universal Phone Link
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Any Device
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connect iPhone, Android, Tablet, or PC with 0 setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1 text-xs font-medium">
          <button
            id="tab-pair-qr"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'qr'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR</span>
          </button>

          <button
            id="tab-pair-code"
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'code'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Enter PIN</span>
          </button>

          <button
            id="tab-pair-nearby"
            onClick={() => {
              setActiveTab('nearby');
              onRefreshNearby();
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'nearby'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Nearby Phones</span>
          </button>

          <button
            id="tab-pair-diagnostics"
            onClick={() => setActiveTab('diagnostics')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Compatibility & Diagnostics"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>
        </div>

        {/* Live Active Connection Alert Banner */}
        {connectionState === 'connected' && (
          <div className="mx-5 mb-3 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-left shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-200">
                  Connected with {connectedDevice?.name || 'Mobile Peer'}!
                </p>
                <p className="text-[11px] text-emerald-300/80">
                  Active wireless link established. Messages and files will sync in real time.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all shrink-0 ml-2"
            >
              Open Chat
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: QR CODE PAIRING */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-white p-3 rounded-2xl shadow-xl ring-4 ring-blue-600/20">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Pairing QR Code"
                    className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl block"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                )}
              </div>

              {/* 4-digit PIN Banner */}
              <div className="w-full max-w-sm bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Pairing PIN Code
                  </span>
                  <div className="text-2xl font-mono font-bold tracking-widest text-blue-400">
                    {roomCode || '----'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCreateHostCode}
                    disabled={isGenerating}
                    title="Generate New PIN"
                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions: Open Peer in New Window/Tab */}
              <div className="w-full max-w-sm flex gap-2">
                <button
                  onClick={handleOpenPeerTab}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 text-xs font-medium transition-all"
                  title="Test pairing on this device in a second browser window"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Test in 2nd Tab / Window</span>
                </button>

                <button
                  onClick={handleNativeShare}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Share Link</span>
                </button>
              </div>

              {/* Step-by-step instructions */}
              <div className="w-full max-w-sm space-y-2 text-left text-xs text-slate-400">
                <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-950 text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                    1
                  </span>
                  <p>
                    Open the camera app or Google Lens on any <strong>iPhone</strong> or <strong>Android phone</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-blue-950 text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                    2
                  </span>
                  <p>
                    Scan the QR code to open the link, or open this website and type PIN <strong className="text-blue-400">{roomCode}</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                    3
                  </span>
                  <p>
                    Both phones connect automatically! Send messages, photos, and files in real-time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENTER PIN CODE */}
          {activeTab === 'code' && (
            <div className="space-y-4 max-w-sm mx-auto py-2">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">Join with 4-Digit PIN</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter the Bluetooth pairing PIN displayed on the other phone
                </p>
              </div>

              <form onSubmit={handleJoinSubmit} className="space-y-3">
                <div>
                  <input
                    type="text"
                    maxLength={8}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 4821"
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-blue-500 rounded-2xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-white placeholder-slate-600 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                {joinError && (
                  <p className="text-xs text-rose-400 text-center bg-rose-950/40 border border-rose-800/60 p-2 rounded-xl">
                    {joinError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!inputCode.trim() || isJoining}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isJoining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting to Phone...</span>
                    </>
                  ) : (
                    <>
                      <span>Pair & Start Chatting</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Preset PINs for instant test */}
              <div className="pt-2">
                <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider block mb-2 text-center">
                  Quick Test Sessions
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('DEMO');
                      onJoinSession('DEMO');
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Join "DEMO"</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('TEST');
                      onJoinSession('TEST');
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Join "TEST"</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NEARBY ACTIVE PHONES */}
          {activeTab === 'nearby' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>Active Phones on Network ({nearbyPhones.length})</span>
                  {isRefreshingNearby && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
                </span>
                <button
                  onClick={onRefreshNearby}
                  disabled={isRefreshingNearby}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNearby ? 'animate-spin' : ''}`} />
                  <span>Scan</span>
                </button>
              </div>

              {nearbyPhones.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-2xl">
                  <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-slate-300 font-medium">No other phones detected nearby</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Open this app on another phone or browser tab. As soon as it opens, it will appear here!
                  </p>
                  <button
                    onClick={() => setActiveTab('qr')}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-xl font-medium"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Show QR Code on this phone</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {nearbyPhones.map((device) => (
                    <div
                      key={device.id}
                      className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-blue-500/50 flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white">
                              {device.name}
                            </h4>
                            {device.os && (
                              <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                {device.os}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="font-mono text-[11px] text-blue-300 font-medium">
                              {device.address}
                            </span>
                            <span className="flex items-center gap-1">
                              <Wifi className="w-3 h-3 text-emerald-400" />
                              {device.rssi} dBm
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onConnectDevice(device);
                          onClose();
                        }}
                        className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-sm"
                      >
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & PHONE INFO */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2.5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span>Current Phone Hardware & OS</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-800/80">
                    <span className="text-slate-400 block">Device Model:</span>
                    <span className="text-slate-200 font-semibold">{phoneInfo.deviceModel}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800/80">
                    <span className="text-slate-400 block">Operating System:</span>
                    <span className="text-slate-200 font-semibold">
                      {phoneInfo.os} {phoneInfo.osVersion}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800/80">
                    <span className="text-slate-400 block">Browser Engine:</span>
                    <span className="text-slate-200 font-semibold">{phoneInfo.browser}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800/80">
                    <span className="text-slate-400 block">Universal Phone Link:</span>
                    <span className="text-emerald-400 font-semibold">100% Supported</span>
                  </div>
                </div>
              </div>

              {/* Feature Matrix */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Phone Hardware APIs
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-800/50 flex items-center justify-between border border-slate-800">
                    <span className="text-slate-300">Web Bluetooth API (Physical BLE)</span>
                    <span className={phoneInfo.hasWebBluetooth ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {phoneInfo.hasWebBluetooth ? 'Enabled (Chrome/Edge)' : 'Simulated / Bluefy on iOS'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/50 flex items-center justify-between border border-slate-800">
                    <span className="text-slate-300">Haptic Vibration Engine</span>
                    <span className={phoneInfo.hasVibration ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {phoneInfo.hasVibration ? 'Active (Haptic Pulses)' : 'Not Supported by OS'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/50 flex items-center justify-between border border-slate-800">
                    <span className="text-slate-300">Screen WakeLock (Stay Awake)</span>
                    <span className={phoneInfo.hasWakeLock ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {phoneInfo.hasWakeLock ? 'Available' : 'Fallback Timer'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/50 flex items-center justify-between border border-slate-800">
                    <span className="text-slate-300">Native Share Sheet (AirDrop / Nearby)</span>
                    <span className={phoneInfo.hasWebShare ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {phoneInfo.hasWebShare ? 'Available' : 'Clipboard Fallback'}
                    </span>
                  </div>
                </div>
              </div>

              {/* iPhone specific tips */}
              {phoneInfo.isIos && (
                <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-2xl text-blue-200 text-xs">
                  <span className="font-semibold text-blue-300 block mb-1">
                    Notice for Apple iPhone / iPad:
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Apple WebKit natively supports the Universal Phone Link (QR & PIN code). To connect to physical raw BLE microcontrollers like ESP32 from an iPhone, download the free <strong>Bluefy - Web BLE Browser</strong> from the App Store.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <span>Encrypted RFCOMM / WebSocket Packet Bridge</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
