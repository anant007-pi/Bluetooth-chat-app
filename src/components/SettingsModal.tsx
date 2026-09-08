import React, { useState } from 'react';
import { X, Save, RotateCcw, Smartphone, Radio, Sliders, Volume2, Shield } from 'lucide-react';
import { BluetoothSettings } from '../types';
import { generateMacAddress } from '../utils/bluetoothEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BluetoothSettings;
  onSaveSettings: (settings: BluetoothSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<BluetoothSettings>({ ...settings });

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const handleRegenerateMac = () => {
    setFormData((prev) => ({ ...prev, localMacAddress: generateMacAddress() }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Bluetooth Chat Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Identity */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              Device Identity & Discovery
            </h3>

            <div>
              <label className="block text-slate-400 mb-1">Local Device Broadcast Name</label>
              <input
                type="text"
                value={formData.localDeviceName}
                onChange={(e) => setFormData({ ...formData, localDeviceName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Bluetooth MAC / BD_ADDR</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={formData.localMacAddress}
                  className="w-full bg-slate-800/70 border border-slate-700/60 rounded-lg px-3 py-1.5 text-slate-300 font-mono"
                />
                <button
                  type="button"
                  onClick={handleRegenerateMac}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700"
                  title="Generate new MAC address"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">Discoverable Timeout</label>
                <select
                  value={formData.discoverableTimeoutSec}
                  onChange={(e) => setFormData({ ...formData, discoverableTimeoutSec: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={120}>120 seconds (Android standard)</option>
                  <option value={300}>300 seconds (5 minutes)</option>
                  <option value={600}>600 seconds (10 minutes)</option>
                  <option value={0}>Always Visible</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Packet End Delimiter</label>
                <select
                  value={formData.packetDelimiter}
                  onChange={(e) => setFormData({ ...formData, packetDelimiter: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="\n">\n (Newline)</option>
                  <option value="\r\n">\r\n (CRLF)</option>
                  <option value="none">None (Raw stream)</option>
                </select>
              </div>
            </div>
          </div>

          {/* BLE GATT Profile */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              GATT Profile & UART Emulation
            </h3>

            <div>
              <label className="block text-slate-400 mb-1">Default BLE Profile</label>
              <select
                value={formData.defaultProfile}
                onChange={(e) => setFormData({ ...formData, defaultProfile: e.target.value as any })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="nordic_uart">Nordic UART Service (NUS 6E400001)</option>
                <option value="hm10">HM-10 / CC2541 Serial (FFE0)</option>
                <option value="spp">Classic Bluetooth Serial Port Profile (SPP 1101)</option>
                <option value="custom">Custom Service UUID</option>
              </select>
            </div>

            {formData.defaultProfile === 'custom' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="block text-slate-400 mb-0.5">Primary Service UUID</label>
                  <input
                    type="text"
                    value={formData.customServiceUuid}
                    onChange={(e) => setFormData({ ...formData, customServiceUuid: e.target.value })}
                    placeholder="e.g. 0000180d-0000-1000-8000-00805f9b34fb"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1">Max MTU Payload Size</label>
              <select
                value={formData.mtuSize}
                onChange={(e) => setFormData({ ...formData, mtuSize: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value={247}>247 bytes (BLE 4.2 / 5.x Extended Data Length)</option>
                <option value={128}>128 bytes (Balanced)</option>
                <option value={23}>23 bytes (BLE 4.0 Legacy minimum - 20B data)</option>
              </select>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Audio Feedback
            </h3>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formData.soundEnabled}
                onChange={(e) => setFormData({ ...formData, soundEnabled: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-blue-500"
              />
              <span className="text-slate-300">Play synthetic audio tones for message send/receive and connection</span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
