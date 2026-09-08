import React from 'react';
import { X, ShieldCheck, CheckCircle2, Code2, Cpu, ExternalLink, AlertCircle } from 'lucide-react';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWebBleSupported: boolean;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  isWebBleSupported,
}) => {
  if (!isOpen) return null;

  const permissions = [
    {
      name: 'android.permission.BLUETOOTH',
      scope: 'API <= 30 (Legacy)',
      status: 'Active',
      desc: 'Allows applications to connect to paired Bluetooth devices and exchange RFCOMM data.',
    },
    {
      name: 'android.permission.BLUETOOTH_ADMIN',
      scope: 'API <= 30 (Legacy)',
      status: 'Active',
      desc: 'Allows applications to discover nearby devices and manipulate Bluetooth adapter settings.',
    },
    {
      name: 'android.permission.BLUETOOTH_SCAN',
      flags: 'neverForLocation',
      scope: 'API >= 31 (Android 12+)',
      status: 'Active',
      desc: 'Allows searching for Bluetooth devices without deriving physical GPS location.',
    },
    {
      name: 'android.permission.BLUETOOTH_CONNECT',
      scope: 'API >= 31 (Android 12+)',
      status: 'Active',
      desc: 'Required to initiate connections, transmit packets, and bond with discovered devices.',
    },
    {
      name: 'android.permission.BLUETOOTH_ADVERTISE',
      scope: 'API >= 31 (Android 12+)',
      status: 'Active',
      desc: 'Required to broadcast discovery beacons and make this device discoverable to peers.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Android Manifest & Permissions</h2>
              <p className="text-xs text-slate-400">Bluetooth security model and Web Bluetooth mapping</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Runtime Environment Check */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2 text-xs">
              <Cpu className="w-4 h-4 text-blue-400" />
              Runtime Adapter Status
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Web Bluetooth API:</span>
                <span className={isWebBleSupported ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                  {isWebBleSupported ? 'Available (GATT)' : 'Simulated / Mesh'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/80 flex items-center justify-between">
                <span className="text-slate-400">Hardware Feature:</span>
                <span className="text-emerald-400 font-medium font-mono">android.hardware.bluetooth</span>
              </div>
            </div>
          </div>

          {/* Android Permissions List */}
          <div className="space-y-2.5">
            <h3 className="text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              Declared Manifest Permissions
            </h3>
            {permissions.map((perm, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-blue-300 font-medium text-xs break-all">
                    {perm.name}
                  </div>
                  <span className="shrink-0 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Granted
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                  <span>{perm.scope}</span>
                  {perm.flags && <span className="text-amber-400/90">flags="{perm.flags}"</span>}
                </div>
                <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">{perm.desc}</p>
              </div>
            ))}
          </div>

          {/* Manifest Snippet */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                AndroidManifest.xml
              </span>
            </div>
            <pre className="p-3 bg-black/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto selection:bg-blue-900">
{`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
  <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
  <uses-feature android:name="android.hardware.bluetooth" android:required="true" />
</manifest>`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
