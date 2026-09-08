export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

export type DeviceType = 'phone' | 'computer' | 'terminal' | 'wearable' | 'sensor' | 'custom';

export interface BluetoothDeviceItem {
  id: string;
  name: string;
  address: string; // MAC address or UUID
  rssi: number; // in dBm, e.g. -65
  type: DeviceType;
  isPaired: boolean;
  isVirtual: boolean;
  isWebBle?: boolean;
  isPhoneRelay?: boolean;
  relayRoomCode?: string;
  os?: string;
  nativeDevice?: any;
  serviceUuid?: string;
  txUuid?: string;
  rxUuid?: string;
  batteryLevel?: number;
  mtu?: number;
}

export interface BluetoothMessage {
  id: string;
  sender: 'me' | 'peer' | 'system';
  senderName?: string;
  text: string;
  rawHex?: string;
  byteLength: number;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  isCommand?: boolean;
  fileAttachment?: {
    name: string;
    size: number;
    type: string;
    dataUrl?: string;
  };
}

export interface TerminalLogEntry {
  id: string;
  direction: 'TX' | 'RX' | 'SYS';
  timestamp: number;
  text: string;
  hex: string;
  bytes: number;
}

export interface BluetoothSettings {
  localDeviceName: string;
  localMacAddress: string;
  isDiscoverable: boolean;
  discoverableTimeoutSec: number;
  mtuSize: number;
  packetDelimiter: '\\n' | '\\r\\n' | 'none';
  soundEnabled: boolean;
  hapticEnabled: boolean;
  defaultProfile: 'nordic_uart' | 'hm10' | 'spp' | 'custom';
  customServiceUuid: string;
  customTxUuid: string;
  customRxUuid: string;
}
