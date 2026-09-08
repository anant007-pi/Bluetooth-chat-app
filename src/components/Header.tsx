import React from 'react';
import {
  Bluetooth,
  BluetoothOff,
  BluetoothSearching,
  Radio,
  Terminal,
  MessageSquare,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Wifi,
  ShieldCheck,
  Smartphone,
  QrCode,
} from 'lucide-react';
import { BluetoothDeviceItem, ConnectionState } from '../types';

interface HeaderProps {
  bluetoothEnabled: boolean;
  onToggleBluetooth: () => void;
  connectionState: ConnectionState;
  connectedDevice: BluetoothDeviceItem | null;
  onOpenScanner: () => void;
  onOpenPairPhone: () => void;
  onDisconnect: () => void;
  viewMode: 'chat' | 'terminal';
  onToggleViewMode: (mode: 'chat' | 'terminal') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenPermissions: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  bluetoothEnabled,
  onToggleBluetooth,
  connectionState,
  connectedDevice,
  onOpenScanner,
  onOpenPairPhone,
  onDisconnect,
  viewMode,
  onToggleViewMode,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  onOpenPermissions,
}) => {
  const getRssiSignalLevel = (rssi: number) => {
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    return 1;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
              !bluetoothEnabled
                ? 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'
                : connectionState === 'connected'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-400/40'
                : 'bg-blue-950/80 text-blue-400 border border-blue-800/60'
            }`}
          >
            {bluetoothEnabled ? (
              <Bluetooth className={`w-5 h-5 ${connectionState === 'connecting' ? 'animate-pulse' : ''}`} />
            ) : (
              <BluetoothOff className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-1.5">
                Bluetooth Chat
              </h1>
              <span className="hidden xs:inline-flex items-center text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-800/60">
                RFCOMM / BLE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {!bluetoothEnabled ? (
                <span className="text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                  Bluetooth is Turned Off
                </span>
              ) : connectionState === 'connected' && connectedDevice ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                  Linked to {connectedDevice.name}
                </span>
              ) : connectionState === 'connecting' ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse"></span>
                  Connecting to device...
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"></span>
                  Ready to pair
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Center: Active Connection Badge & Quick Connect */}
        <div className="flex items-center gap-2 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-start">
          {bluetoothEnabled && (
            <>
              {connectionState === 'connected' && connectedDevice ? (
                <div className="flex items-center gap-2 bg-slate-800/90 border border-blue-500/30 rounded-lg px-2.5 py-1 text-xs text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-medium max-w-[120px] sm:max-w-[160px] truncate">
                      {connectedDevice.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                      [{connectedDevice.address}]
                    </span>
                  </div>

                  {connectedDevice.rssi && (
                    <div
                      className="flex items-center gap-0.5 text-[10px] text-slate-400 px-1 border-l border-slate-700"
                      title={`Signal RSSI: ${connectedDevice.rssi} dBm`}
                    >
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>{connectedDevice.rssi} dBm</span>
                    </div>
                  )}

                  <button
                    id="btn-disconnect"
                    onClick={onDisconnect}
                    className="ml-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-scan-devices"
                    onClick={onOpenScanner}
                    disabled={!bluetoothEnabled || connectionState === 'connecting'}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <BluetoothSearching className="w-4 h-4 text-blue-400" />
                    <span className="hidden sm:inline">BLE Scanner</span>
                  </button>

                  <button
                    id="btn-pair-phone"
                    onClick={onOpenPairPhone}
                    disabled={!bluetoothEnabled}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Pair Any Phone</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Mode Switcher: Chat vs Terminal */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 text-xs">
            <button
              id="tab-chat-mode"
              onClick={() => onToggleViewMode('chat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              id="tab-terminal-mode"
              onClick={() => onToggleViewMode('terminal')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'terminal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 order-2 sm:order-3">
          {/* Bluetooth Power Switch */}
          <button
            id="btn-toggle-bluetooth"
            onClick={onToggleBluetooth}
            title={bluetoothEnabled ? 'Turn Bluetooth OFF' : 'Turn Bluetooth ON'}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all ${
              bluetoothEnabled
                ? 'bg-slate-800 border-blue-500/40 text-blue-300 hover:bg-slate-700/80'
                : 'bg-rose-950/40 border-rose-800/50 text-rose-300 hover:bg-rose-900/50'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${bluetoothEnabled ? 'text-blue-400' : 'text-rose-400'}`} />
            <span className="hidden sm:inline">{bluetoothEnabled ? 'BT On' : 'BT Off'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Permissions / Android Manifest Info */}
          <button
            id="btn-open-permissions"
            onClick={onOpenPermissions}
            title="Android Permissions & Features"
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Settings Modal */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            title="Bluetooth Settings"
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
