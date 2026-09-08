import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Bluetooth,
  Smartphone,
  Cpu,
  Laptop,
  Headphones,
  Radio,
  Plus,
  Wifi,
  ExternalLink,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { BluetoothDeviceItem } from '../types';

interface DeviceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairedDevices: BluetoothDeviceItem[];
  discoveredDevices: BluetoothDeviceItem[];
  isScanning: boolean;
  onStartScan: () => void;
  onConnectDevice: (device: BluetoothDeviceItem) => void;
  onConnectWebBle: () => void;
  onOpenPairPhone?: () => void;
  isWebBleSupported: boolean;
  onAddCustomDevice: (name: string, type: BluetoothDeviceItem['type']) => void;
  isDiscoverable: boolean;
  onToggleDiscoverable: () => void;
  discoverableRemaining: number;
}

export const DeviceScannerModal: React.FC<DeviceScannerModalProps> = ({
  isOpen,
  onClose,
  pairedDevices,
  discoveredDevices,
  isScanning,
  onStartScan,
  onConnectDevice,
  onConnectWebBle,
  onOpenPairPhone,
  isWebBleSupported,
  onAddCustomDevice,
  isDiscoverable,
  onToggleDiscoverable,
  discoverableRemaining,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<BluetoothDeviceItem['type']>('phone');

  useEffect(() => {
    if (isOpen && !isScanning && discoveredDevices.length === 0) {
      onStartScan();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    onAddCustomDevice(newDeviceName.trim(), newDeviceType);
    setNewDeviceName('');
    setShowAddModal(false);
  };

  const getDeviceIcon = (type: BluetoothDeviceItem['type']) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'terminal':
      case 'sensor':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case 'computer':
        return <Laptop className="w-4 h-4 text-indigo-400" />;
      case 'wearable':
        return <Headphones className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bluetooth className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Bluetooth className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Bluetooth Device Discovery</h2>
              <p className="text-xs text-slate-400">Scan, pair, and connect to RFCOMM / BLE peers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Status & Web BLE Option Bar */}
        <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onStartScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Nearby...' : 'Scan Nearby'}</span>
            </button>

            {isWebBleSupported && (
              <button
                onClick={onConnectWebBle}
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-medium px-3 py-1.5 rounded-lg transition-colors"
                title="Use Web Bluetooth API to pair with real physical hardware"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pair Physical BLE Hardware</span>
              </button>
            )}

            {onOpenPairPhone && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPairPhone();
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition-all"
                title="Pair any iPhone, Android, or tablet via QR or PIN"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Pair Any Phone (QR / Code)</span>
              </button>
            )}
          </div>

          {/* Discoverable status */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Discoverable:</span>
            <button
              onClick={onToggleDiscoverable}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors border ${
                isDiscoverable
                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isDiscoverable ? `Active (${discoverableRemaining}s)` : 'Hidden'}
            </button>
          </div>
        </div>

        {/* Device List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Paired Devices */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Paired Devices ({pairedDevices.length})
              </h3>
            </div>

            {pairedDevices.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No paired Bluetooth devices.</p>
            ) : (
              <div className="space-y-2">
                {pairedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {getDeviceIcon(device.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-white">
                            {device.name}
                          </h4>
                          {device.isVirtual && (
                            <span className="text-[10px] bg-slate-700/80 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                              Simulated
                            </span>
                          )}
                          {device.isWebBle && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.2 rounded">
                              Real BLE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                          <span>{device.address}</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Wifi className="w-3 h-3 text-emerald-400" />
                            {device.rssi} dBm
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onConnectDevice(device)}
                      className="shrink-0 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available / Discovered Devices */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>Available Devices ({discoveredDevices.length})</span>
                {isScanning && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>}
              </h3>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Device</span>
              </button>
            </div>

            {discoveredDevices.length === 0 ? (
              <div className="text-center py-6 px-4 border border-dashed border-slate-800 rounded-xl">
                <Radio className="w-6 h-6 text-slate-600 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-slate-400">
                  {isScanning ? 'Listening for Bluetooth advertisement beacons...' : 'No available devices discovered yet.'}
                </p>
                <button
                  onClick={onStartScan}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Start scan now
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {discoveredDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {getDeviceIcon(device.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-white">
                            {device.name}
                          </h4>
                          {device.id.startsWith('tab_') && (
                            <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-medium">
                              Live Tab Peer
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                          <span>{device.address}</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Wifi className="w-3 h-3 text-emerald-400" />
                            {device.rssi} dBm
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onConnectDevice(device)}
                      className="shrink-0 bg-slate-700 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      Pair & Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Peer Mesh Notice */}
          <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-200">Real Wireless Multi-Tab P2P Mesh</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Open this app in another browser tab or window. Both instances will discover each other as live Bluetooth
                peers via BroadcastChannel and can exchange messages in real-time!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Compliant with Android 12+ Bluetooth permissions
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Custom Device Nested Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-1">Add Custom Virtual Device</h3>
            <p className="text-xs text-slate-400 mb-4">Create a virtual Bluetooth peripheral to test with</p>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Device Name</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g. RaspberryPi-Zero or Arduino-BT"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Device Type</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="phone">Smartphone (Android/iOS)</option>
                  <option value="terminal">Microcontroller (ESP32/Arduino)</option>
                  <option value="computer">Laptop / PC</option>
                  <option value="wearable">Wearable / Audio</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDeviceName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white disabled:opacity-50"
                >
                  Add Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
