/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ChatView } from './components/ChatView';
import { TerminalView } from './components/TerminalView';
import { DeviceScannerModal } from './components/DeviceScannerModal';
import { SettingsModal } from './components/SettingsModal';
import { PermissionsModal } from './components/PermissionsModal';
import { TransferProgressModal, TransferStatus } from './components/TransferProgressModal';
import { PairAnyPhoneModal } from './components/PairAnyPhoneModal';
import {
  BluetoothDeviceItem,
  BluetoothMessage,
  ConnectionState,
  BluetoothSettings,
  TerminalLogEntry,
} from './types';
import {
  BluetoothEngine,
  generateMacAddress,
  stringToHex,
} from './utils/bluetoothEngine';
import { soundManager } from './utils/audio';
import {
  detectPhoneInfo,
  PhoneInfo,
  triggerHaptic,
  requestWakeLock,
} from './utils/phoneDiagnostics';

const INITIAL_PAIRED_DEVICES: BluetoothDeviceItem[] = [
  {
    id: 'virt_pixel8',
    name: 'Pixel 8 Pro (Chat Service)',
    address: '74:D2:1D:9A:E4:B2',
    rssi: -54,
    type: 'phone',
    isPaired: true,
    isVirtual: true,
    mtu: 247,
  },
  {
    id: 'virt_esp32',
    name: 'ESP32-BLE-Terminal',
    address: '24:0A:C4:F3:18:7E',
    rssi: -66,
    type: 'terminal',
    isPaired: true,
    isVirtual: true,
    mtu: 247,
  },
  {
    id: 'virt_hc05',
    name: 'HC-05 Serial Adapter',
    address: '98:D3:31:80:44:A1',
    rssi: -78,
    type: 'sensor',
    isPaired: true,
    isVirtual: true,
    mtu: 128,
  },
];

const DEFAULT_SETTINGS: BluetoothSettings = {
  localDeviceName: 'Android BT Chat Station',
  localMacAddress: generateMacAddress(),
  isDiscoverable: true,
  discoverableTimeoutSec: 300,
  mtuSize: 247,
  packetDelimiter: '\\n',
  soundEnabled: true,
  hapticEnabled: true,
  defaultProfile: 'nordic_uart',
  customServiceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  customTxUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  customRxUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
};

export default function App() {
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDeviceItem | null>(null);

  const [pairedDevices, setPairedDevices] = useState<BluetoothDeviceItem[]>(INITIAL_PAIRED_DEVICES);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDeviceItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const [viewMode, setViewMode] = useState<'chat' | 'terminal'>('chat');
  const [messages, setMessages] = useState<BluetoothMessage[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);

  const [settings, setSettings] = useState<BluetoothSettings>(DEFAULT_SETTINGS);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [discoverableRemaining, setDiscoverableRemaining] = useState(300);

  // Phone Universal Compatibility States
  const [phoneInfo] = useState<PhoneInfo>(() => detectPhoneInfo());
  const [isPairPhoneOpen, setIsPairPhoneOpen] = useState(false);
  const [currentPhoneRoomCode, setCurrentPhoneRoomCode] = useState<string | null>(null);
  const [nearbyPhones, setNearbyPhones] = useState<BluetoothDeviceItem[]>([]);
  const [isRefreshingNearby, setIsRefreshingNearby] = useState(false);
  const wakeLockReleaseRef = useRef<(() => void) | null>(null);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(null);

  const engineRef = useRef<BluetoothEngine>(BluetoothEngine.getInstance());
  const scanTimerRef = useRef<any>(null);
  const discoverableTimerRef = useRef<any>(null);

  const isWebBleSupported = engineRef.current.isWebBluetoothSupported();

  // Initialize engine callbacks and phone identification
  useEffect(() => {
    const engine = engineRef.current;

    // Set local identity using detected phone model
    const detectedName = `${phoneInfo.deviceModel} (BT Station)`;
    setSettings((prev) => ({
      ...prev,
      localDeviceName: detectedName,
    }));
    engine.setDeviceDetails(detectedName, settings.localMacAddress, isDiscoverable, phoneInfo.os);

    engine.setCallbacks({
      onConnectionChange: (state, device) => {
        setConnectionState(state);
        setConnectedDevice(device);

        if (state === 'connected' && device) {
          soundManager.playConnect();
          triggerHaptic('connected');
          // Request Screen WakeLock so phones don't sleep during chat
          requestWakeLock().then((release) => {
            wakeLockReleaseRef.current = release;
          });

          const sysMsg: BluetoothMessage = {
            id: 'sys_' + Date.now(),
            sender: 'system',
            text: `Bluetooth RFCOMM connection established with ${device.name} [${device.address}]. MTU ${device.mtu || 247} bytes.`,
            byteLength: 0,
            timestamp: Date.now(),
            status: 'delivered',
          };
          setMessages((prev) => [...prev, sysMsg]);
        } else if (state === 'disconnected') {
          soundManager.playDisconnect();
          triggerHaptic('disconnected');
          if (wakeLockReleaseRef.current) {
            wakeLockReleaseRef.current();
            wakeLockReleaseRef.current = null;
          }
          const sysMsg: BluetoothMessage = {
            id: 'sys_' + Date.now(),
            sender: 'system',
            text: 'Bluetooth link terminated.',
            byteLength: 0,
            timestamp: Date.now(),
            status: 'delivered',
          };
          setMessages((prev) => [...prev, sysMsg]);
        }
      },
      onDataReceived: (text, rawHex, bytes, fileAttachment) => {
        soundManager.playReceive();
        triggerHaptic('received');
        const newMsg: BluetoothMessage = {
          id: 'rx_' + Date.now() + Math.random().toString(36).substring(2, 6),
          sender: 'peer',
          senderName: engine.getCurrentDevice()?.name || 'Peer',
          text,
          rawHex,
          byteLength: bytes,
          timestamp: Date.now(),
          status: 'delivered',
          fileAttachment,
        };
        setMessages((prev) => [...prev, newMsg]);
      },
      onDataSent: (text, rawHex, bytes, fileAttachment) => {
        soundManager.playSend();
        triggerHaptic('sent');
        const newMsg: BluetoothMessage = {
          id: 'tx_' + Date.now() + Math.random().toString(36).substring(2, 6),
          sender: 'me',
          text,
          rawHex,
          byteLength: bytes,
          timestamp: Date.now(),
          status: 'delivered',
          fileAttachment,
        };
        setMessages((prev) => [...prev, newMsg]);
      },
      onLog: (direction, text, hex, bytes) => {
        const entry: TerminalLogEntry = {
          id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
          direction,
          timestamp: Date.now(),
          text,
          hex,
          bytes,
        };
        setTerminalLogs((prev) => [...prev.slice(-199), entry]);
      },
    });

    // Check for ?pair=CODE query parameter from scanned QR code
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pairCode = params.get('pair');
      if (pairCode) {
        handleJoinPhoneSession(pairCode.toUpperCase().trim());
      }
    }

    // Listen for live tab discovery beacons
    const handlePeerDiscovered = (e: any) => {
      const peer = e.detail;
      setDiscoveredDevices((prev) => {
        const exists = prev.some((d) => d.id === peer.id);
        if (exists) return prev;
        return [peer, ...prev];
      });
    };

    window.addEventListener('bt_peer_discovered', handlePeerDiscovered);
    return () => {
      window.removeEventListener('bt_peer_discovered', handlePeerDiscovered);
    };
  }, []);

  // Discoverable countdown timer
  useEffect(() => {
    if (isDiscoverable && discoverableRemaining > 0) {
      discoverableTimerRef.current = setInterval(() => {
        setDiscoverableRemaining((prev) => {
          if (prev <= 1) {
            setIsDiscoverable(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (discoverableTimerRef.current) clearInterval(discoverableTimerRef.current);
    }
    return () => {
      if (discoverableTimerRef.current) clearInterval(discoverableTimerRef.current);
    };
  }, [isDiscoverable, discoverableRemaining]);

  // Sync sound manager settings
  useEffect(() => {
    soundManager.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Toggle Bluetooth Adapter Power
  const handleToggleBluetooth = () => {
    if (bluetoothEnabled) {
      if (connectionState === 'connected') {
        engineRef.current.disconnect();
      }
      setBluetoothEnabled(false);
      setConnectionState('disconnected');
      setConnectedDevice(null);
      setIsScanning(false);
    } else {
      setBluetoothEnabled(true);
      engineRef.current.setLocalIdentity(settings.localDeviceName, settings.localMacAddress, isDiscoverable);
    }
  };

  // Start Device Discovery Scan
  const handleStartScan = useCallback(() => {
    if (!bluetoothEnabled || isScanning) return;
    setIsScanning(true);

    // Initial simulated scan batch
    setTimeout(() => {
      const simulatedNearby: BluetoothDeviceItem[] = [
        {
          id: 'scan_galaxy',
          name: 'Samsung Galaxy Tab S9',
          address: 'BC:83:85:29:41:0C',
          rssi: -62,
          type: 'phone',
          isPaired: false,
          isVirtual: true,
          mtu: 247,
        },
        {
          id: 'scan_macbook',
          name: "Alex's MacBook Pro (BLE Chat)",
          address: '40:B0:76:88:E2:10',
          rssi: -71,
          type: 'computer',
          isPaired: false,
          isVirtual: true,
          mtu: 247,
        },
        {
          id: 'scan_nordic',
          name: 'Nordic nRF52840 Dongle',
          address: 'F4:CE:36:11:80:55',
          rssi: -58,
          type: 'terminal',
          isPaired: false,
          isVirtual: true,
          mtu: 247,
        },
      ];

      setDiscoveredDevices((prev) => {
        const unique = [...prev];
        simulatedNearby.forEach((item) => {
          if (!unique.some((d) => d.id === item.id)) {
            unique.push(item);
          }
        });
        return unique;
      });
    }, 1200);

    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
    }, 8000);
  }, [bluetoothEnabled, isScanning]);

  // Connect to device
  const handleConnectDevice = async (device: BluetoothDeviceItem) => {
    setIsScannerOpen(false);
    try {
      await engineRef.current.connectDevice(device);
      // Auto-add to paired list if not already
      setPairedDevices((prev) => {
        if (prev.some((d) => d.id === device.id)) return prev;
        return [{ ...device, isPaired: true }, ...prev];
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Connect via Web Bluetooth API (Real Hardware)
  const handleConnectWebBle = async () => {
    try {
      const dev = await engineRef.current.connectWebBluetooth(settings);
      setIsScannerOpen(false);
      setPairedDevices((prev) => {
        if (prev.some((d) => d.id === dev.id)) return prev;
        return [dev, ...prev];
      });
    } catch (err: any) {
      console.error('Web BLE error:', err);
    }
  };

  // Disconnect active device
  const handleDisconnect = async () => {
    await engineRef.current.disconnect();
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!bluetoothEnabled || connectionState !== 'connected') return;
    try {
      await engineRef.current.sendData(text, settings.packetDelimiter);
    } catch (err: any) {
      console.error('Send error:', err);
    }
  };

  // Host universal phone room
  const handleHostPhoneSession = async (customCode?: string) => {
    const res = await engineRef.current.hostPhoneRoom(customCode);
    setCurrentPhoneRoomCode(res.code);
    return res;
  };

  // Join universal phone room
  const handleJoinPhoneSession = async (code: string) => {
    try {
      const dev = await engineRef.current.joinPhoneRoom(code);
      setCurrentPhoneRoomCode(code);
      setConnectedDevice(dev);
      setConnectionState('connected');
      setPairedDevices((prev) => {
        if (prev.some((d) => d.id === dev.id)) return prev;
        return [dev, ...prev];
      });
    } catch (err: any) {
      console.error('Join phone session error:', err);
      throw err;
    }
  };

  // Refresh active nearby phones
  const handleRefreshNearbyPhones = async () => {
    setIsRefreshingNearby(true);
    try {
      const rooms = await engineRef.current.fetchActiveRooms();
      setNearbyPhones(rooms);
    } catch (err) {
      console.warn('Fetch rooms error:', err);
    } finally {
      setIsRefreshingNearby(false);
    }
  };

  // Send simulated/real file transfer with chunking progress
  const handleSendFile = (file: File) => {
    if (!bluetoothEnabled || connectionState !== 'connected' || !connectedDevice) return;

    const packetSize = Math.min(240, settings.mtuSize - 7);
    const totalPackets = Math.ceil(file.size / packetSize);

    setTransferStatus({
      active: true,
      fileName: file.name,
      totalBytes: file.size,
      transferredBytes: 0,
      currentPacket: 0,
      totalPackets,
      speedBps: 24000,
      completed: false,
    });

    // Read base64 payload for real peer-to-peer transmission
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const fileAttachment = {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl,
      };
      // Send through engine (SSE room or BroadcastChannel)
      engineRef.current.sendFilePayload(fileAttachment, file.name, file.size);
    };
    reader.readAsDataURL(file);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      const transferred = Math.min(file.size, current * packetSize);

      setTransferStatus((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentPacket: current,
          transferredBytes: transferred,
          completed: current >= totalPackets,
        };
      });

      if (current >= totalPackets) {
        clearInterval(interval);
      }
    }, 100);
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([]);
  };

  // Clear logs
  const handleClearLogs = () => {
    setTerminalLogs([]);
  };

  // Quick connect to virtual device
  const handleQuickConnectVirtual = (type: 'phone' | 'esp32') => {
    const target = pairedDevices.find((d) =>
      type === 'phone' ? d.name.includes('Pixel') : d.name.includes('ESP32')
    );
    if (target) {
      handleConnectDevice(target);
    }
  };

  // Add custom virtual device
  const handleAddCustomDevice = (name: string, type: BluetoothDeviceItem['type']) => {
    const newDev: BluetoothDeviceItem = {
      id: 'custom_' + Date.now(),
      name,
      address: generateMacAddress(),
      rssi: -50 - Math.floor(Math.random() * 25),
      type,
      isPaired: false,
      isVirtual: true,
      mtu: 247,
    };
    setDiscoveredDevices((prev) => [newDev, ...prev]);
  };

  // Toggle discoverable
  const handleToggleDiscoverable = () => {
    if (isDiscoverable) {
      setIsDiscoverable(false);
      setDiscoverableRemaining(0);
    } else {
      setIsDiscoverable(true);
      setDiscoverableRemaining(settings.discoverableTimeoutSec || 300);
      engineRef.current.setLocalIdentity(settings.localDeviceName, settings.localMacAddress, true);
    }
  };

  // Save settings
  const handleSaveSettings = (newSettings: BluetoothSettings) => {
    setSettings(newSettings);
    engineRef.current.setLocalIdentity(
      newSettings.localDeviceName,
      newSettings.localMacAddress,
      isDiscoverable
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 antialiased overflow-hidden select-none">
      {/* App Header */}
      <Header
        bluetoothEnabled={bluetoothEnabled}
        onToggleBluetooth={handleToggleBluetooth}
        connectionState={connectionState}
        connectedDevice={connectedDevice}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenPairPhone={() => {
          handleRefreshNearbyPhones();
          setIsPairPhoneOpen(true);
        }}
        onDisconnect={handleDisconnect}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() =>
          setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPermissions={() => setIsPermissionsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {viewMode === 'chat' ? (
          <ChatView
            messages={messages}
            connectedDevice={connectedDevice}
            connectionState={connectionState}
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onClearChat={handleClearChat}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenPairPhone={() => {
              handleRefreshNearbyPhones();
              setIsPairPhoneOpen(true);
            }}
            delimiter={settings.packetDelimiter}
            onQuickConnectVirtual={handleQuickConnectVirtual}
          />
        ) : (
          <TerminalView
            logs={terminalLogs}
            connectedDevice={connectedDevice}
            onSendCommand={handleSendMessage}
            onClearLogs={handleClearLogs}
            delimiter={settings.packetDelimiter}
          />
        )}
      </main>

      {/* Universal Phone Pairing Modal (QR / PIN / Cross-phone) */}
      <PairAnyPhoneModal
        isOpen={isPairPhoneOpen}
        onClose={() => setIsPairPhoneOpen(false)}
        localDeviceName={settings.localDeviceName}
        phoneInfo={phoneInfo}
        currentRoomCode={currentPhoneRoomCode}
        onHostNewSession={handleHostPhoneSession}
        onJoinSession={handleJoinPhoneSession}
        onConnectDevice={handleConnectDevice}
        nearbyPhones={nearbyPhones}
        onRefreshNearby={handleRefreshNearbyPhones}
        isRefreshingNearby={isRefreshingNearby}
      />

      {/* Device Discovery & Pairing Modal */}
      <DeviceScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        pairedDevices={pairedDevices}
        discoveredDevices={discoveredDevices}
        isScanning={isScanning}
        onStartScan={handleStartScan}
        onConnectDevice={handleConnectDevice}
        onConnectWebBle={handleConnectWebBle}
        onOpenPairPhone={() => {
          handleRefreshNearbyPhones();
          setIsPairPhoneOpen(true);
        }}
        isWebBleSupported={isWebBleSupported}
        onAddCustomDevice={handleAddCustomDevice}
        isDiscoverable={isDiscoverable}
        onToggleDiscoverable={handleToggleDiscoverable}
        discoverableRemaining={discoverableRemaining}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Android Permissions & Architecture Modal */}
      <PermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
        isWebBleSupported={isWebBleSupported}
      />

      {/* Packet Chunk Transfer Modal */}
      <TransferProgressModal
        transfer={transferStatus}
        onCancel={() => setTransferStatus(null)}
      />
    </div>
  );
}
