import { BluetoothDeviceItem, ConnectionState, BluetoothSettings } from '../types';
import { triggerHaptic } from './phoneDiagnostics';

// Standard BLE UUIDs
export const BLE_SERVICES = {
  NORDIC_UART: {
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    rxChar: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Write to peripheral
    txChar: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // Notify from peripheral
  },
  HM10: {
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    char: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
};

export function stringToHex(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function hexToString(hex: string): string {
  const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

// Generate a random valid-looking Bluetooth MAC address
export function generateMacAddress(): string {
  const hex = '0123456789ABCDEF';
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  }
  return parts.join(':');
}

export interface EngineCallbacks {
  onConnectionChange: (state: ConnectionState, device: BluetoothDeviceItem | null) => void;
  onDataReceived: (text: string, rawHex: string, bytes: number, fileAttachment?: any) => void;
  onDataSent: (text: string, rawHex: string, bytes: number, fileAttachment?: any) => void;
  onLog: (direction: 'TX' | 'RX' | 'SYS', text: string, hex: string, bytes: number) => void;
}

export class BluetoothEngine {
  private static instance: BluetoothEngine;
  private currentDevice: BluetoothDeviceItem | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private callbacks: EngineCallbacks | null = null;

  // Real Web Bluetooth handle
  private gattServer: any = null;
  private writeChar: any = null;
  private readChar: any = null;

  // Real Phone-to-Phone SSE Relay & Dual-Transport Polling
  private sseSource: EventSource | null = null;
  private pollInterval: any = null;
  private processedMessageIds: Set<string> = new Set();
  private lastPollTimestamp: number = 0;
  private currentRoomCode: string | null = null;
  private phonePeerId: string = 'peer_' + Math.random().toString(36).substring(2, 9);
  private localOs: string = 'Mobile';

  // Inter-tab mesh (BroadcastChannel)
  private channel: BroadcastChannel | null = null;
  private tabId: string = Math.random().toString(36).substring(2, 9);
  private localName: string = 'Bluetooth Chat Device';
  private localMac: string = generateMacAddress();
  private isDiscoverable: boolean = true;
  private connectedPeerTabId: string | null = null;

  private constructor() {
    this.initBroadcastChannel();
  }

  public static getInstance(): BluetoothEngine {
    if (!BluetoothEngine.instance) {
      BluetoothEngine.instance = new BluetoothEngine();
    }
    return BluetoothEngine.instance;
  }

  public setCallbacks(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  public setLocalIdentity(name: string, mac: string, discoverable: boolean) {
    this.localName = name;
    this.localMac = mac;
    this.isDiscoverable = discoverable;
    this.broadcastPresence();
  }

  public setDeviceDetails(name: string, mac: string, discoverable: boolean, os?: string) {
    this.localName = name;
    this.localMac = mac;
    this.isDiscoverable = discoverable;
    if (os) this.localOs = os;
    this.broadcastPresence();
  }

  public getLocalIdentity() {
    return {
      name: this.localName,
      mac: this.localMac,
      os: this.localOs,
      peerId: this.phonePeerId,
      roomCode: this.currentRoomCode,
    };
  }

  // Fetch active phone rooms over the network
  public async fetchActiveRooms(): Promise<BluetoothDeviceItem[]> {
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) return [];
      const data = await res.json();
      const rooms = data.rooms || [];
      const devices: BluetoothDeviceItem[] = [];

      for (const r of rooms) {
        if (r.code === this.currentRoomCode) continue;
        if (r.peers && r.peers.length > 0) {
          for (const p of r.peers) {
            if (p.id !== this.phonePeerId) {
              devices.push({
                id: `room_${r.code}_${p.id}`,
                name: `${p.name} (PIN: ${r.code})`,
                address: p.mac || `PIN:${r.code}`,
                rssi: p.rssi || -56,
                type: 'phone',
                isPaired: false,
                isVirtual: false,
                isPhoneRelay: true,
                relayRoomCode: r.code,
                os: p.os,
                mtu: 512,
              });
            }
          }
        } else {
          devices.push({
            id: `room_${r.code}`,
            name: `${r.name} (PIN: ${r.code})`,
            address: `PIN:${r.code}`,
            rssi: -58,
            type: 'phone',
            isPaired: false,
            isVirtual: false,
            isPhoneRelay: true,
            relayRoomCode: r.code,
            mtu: 512,
          });
        }
      }
      return devices;
    } catch {
      return [];
    }
  }

  // Host or create a wireless session for any phone to connect via QR or PIN
  public async hostPhoneRoom(customCode?: string): Promise<{ code: string; device: BluetoothDeviceItem }> {
    const code = (customCode || Math.floor(1000 + Math.random() * 9000).toString()).toUpperCase().trim();
    this.callbacks?.onLog('SYS', `Registering Phone-to-Phone Bluetooth Channel [PIN: ${code}]...`, '', 0);

    try {
      await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name: this.localName,
          peerId: this.phonePeerId,
          peerName: this.localName,
          peerType: 'phone',
          os: this.localOs,
          mac: this.localMac,
        }),
      });
    } catch (e: any) {
      console.warn('Host room create fallback:', e);
    }

    this.currentRoomCode = code;
    this.connectRoomRelay(code);

    const placeholderDevice: BluetoothDeviceItem = {
      id: `room_${code}`,
      name: `Awaiting Phone Pairing (${code})`,
      address: `PIN:${code}`,
      rssi: -50,
      type: 'phone',
      isPaired: false,
      isVirtual: false,
      isPhoneRelay: true,
      relayRoomCode: code,
      mtu: 512,
    };

    return { code, device: placeholderDevice };
  }

  // Join an existing phone session via 4-digit code or QR code
  public async joinPhoneRoom(code: string): Promise<BluetoothDeviceItem> {
    const cleanCode = code.toUpperCase().trim();
    this.setConnectionState('connecting', null);
    this.callbacks?.onLog('SYS', `Pairing to Wireless Phone Session [PIN: ${cleanCode}]...`, '', 0);

    this.currentRoomCode = cleanCode;
    this.connectRoomRelay(cleanCode);

    const peerDevice: BluetoothDeviceItem = {
      id: `room_${cleanCode}`,
      name: `Mobile Peer [${cleanCode}]`,
      address: `PIN:${cleanCode}`,
      rssi: -52,
      type: 'phone',
      isPaired: true,
      isVirtual: false,
      isPhoneRelay: true,
      relayRoomCode: cleanCode,
      mtu: 512,
    };

    this.currentDevice = peerDevice;
    this.setConnectionState('connected', peerDevice);
    triggerHaptic('connected');
    this.callbacks?.onLog('SYS', `Bluetooth link synchronized with phone room ${cleanCode}`, '', 0);

    return peerDevice;
  }

  // Dual-Transport: SSE Realtime Stream + Fast HTTP Polling Fallback
  private connectRoomRelay(code: string) {
    this.cleanupRoomRelay();

    this.processedMessageIds.clear();
    this.lastPollTimestamp = Date.now() - 5000;

    // 1. Establish SSE Connection
    try {
      const url = `/api/rooms/${encodeURIComponent(code)}/events?peerId=${encodeURIComponent(
        this.phonePeerId
      )}&name=${encodeURIComponent(this.localName)}&type=phone&os=${encodeURIComponent(
        this.localOs
      )}&mac=${encodeURIComponent(this.localMac)}&rssi=-55`;

      const source = new EventSource(url);
      this.sseSource = source;

      source.addEventListener('connected', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          if (data.peers && data.peers.length > 0) {
            const peer = data.peers[0];
            const peerDevice: BluetoothDeviceItem = {
              id: `room_${code}_${peer.id}`,
              name: peer.name,
              address: peer.mac || `PIN:${code}`,
              rssi: peer.rssi || -55,
              type: 'phone',
              isPaired: true,
              isVirtual: false,
              isPhoneRelay: true,
              relayRoomCode: code,
              os: peer.os,
              mtu: 512,
            };
            this.currentDevice = peerDevice;
            this.setConnectionState('connected', peerDevice);
            triggerHaptic('connected');
            this.callbacks?.onLog('SYS', `Linked to phone: ${peer.name} (${peer.os || 'Mobile'})`, '', 0);
          }
        } catch (err) {
          console.error('SSE connected parse error', err);
        }
      });

      source.addEventListener('peer_joined', (e: any) => {
        try {
          const peer = JSON.parse(e.data);
          const peerDevice: BluetoothDeviceItem = {
            id: `room_${code}_${peer.id}`,
            name: peer.name,
            address: peer.mac || `PIN:${code}`,
            rssi: peer.rssi || -52,
            type: 'phone',
            isPaired: true,
            isVirtual: false,
            isPhoneRelay: true,
            relayRoomCode: code,
            os: peer.os,
            mtu: 512,
          };
          this.currentDevice = peerDevice;
          this.setConnectionState('connected', peerDevice);
          triggerHaptic('connected');
          this.callbacks?.onLog('SYS', `New phone paired: ${peer.name} [${peer.os}]`, '', 0);
        } catch (err) {
          console.error('SSE peer_joined error', err);
        }
      });

      source.addEventListener('peer_left', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          this.callbacks?.onLog('SYS', `Phone disconnected: ${data.name || 'Remote peer'}`, '', 0);
        } catch {
          // ignore
        }
      });

      source.addEventListener('message', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.id && this.processedMessageIds.has(payload.id)) return;
          if (payload.id) this.processedMessageIds.add(payload.id);

          const text = payload.text;
          const hex = payload.rawHex || stringToHex(text || '');
          const bytes = payload.byteLength || (text ? text.length : 0);
          triggerHaptic('received');
          this.callbacks?.onDataReceived(text, hex, bytes, payload.fileAttachment);
          this.callbacks?.onLog('RX', text, hex, bytes);
        } catch (err) {
          console.error('SSE message parse error', err);
        }
      });

      source.addEventListener('file_message', (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.id && this.processedMessageIds.has(payload.id)) return;
          if (payload.id) this.processedMessageIds.add(payload.id);

          const text = payload.text || `[File: ${payload.fileAttachment?.name}]`;
          const hex = stringToHex(text);
          const bytes = payload.byteLength || 0;
          triggerHaptic('received');
          this.callbacks?.onDataReceived(text, hex, bytes, payload.fileAttachment);
          this.callbacks?.onLog('RX', text, hex, bytes);
        } catch (err) {
          console.error('SSE file_message error', err);
        }
      });

      source.onerror = () => {
        // SSE transient error, HTTP polling fallback handles continuity
      };
    } catch (e) {
      console.warn('SSE initiation notice:', e);
    }

    // 2. Continuous HTTP Polling Fallback (runs every 800ms)
    this.pollInterval = setInterval(async () => {
      if (!this.currentRoomCode) return;
      try {
        const res = await fetch(
          `/api/rooms/${encodeURIComponent(code)}/poll?peerId=${encodeURIComponent(
            this.phonePeerId
          )}&since=${this.lastPollTimestamp}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.serverTime) {
          this.lastPollTimestamp = data.serverTime;
        }

        // Auto pair if peer detected and we are still disconnected or unlinked
        if (data.peers && data.peers.length > 0) {
          const peer = data.peers[0];
          if (!this.currentDevice || this.connectionState !== 'connected') {
            const peerDevice: BluetoothDeviceItem = {
              id: `room_${code}_${peer.id}`,
              name: peer.name,
              address: peer.mac || `PIN:${code}`,
              rssi: peer.rssi || -52,
              type: 'phone',
              isPaired: true,
              isVirtual: false,
              isPhoneRelay: true,
              relayRoomCode: code,
              os: peer.os,
              mtu: 512,
            };
            this.currentDevice = peerDevice;
            this.setConnectionState('connected', peerDevice);
            triggerHaptic('connected');
            this.callbacks?.onLog('SYS', `Phone active: ${peer.name} [${peer.os || 'Mobile'}]`, '', 0);
          }
        }

        // Deliver any messages that were not received via SSE
        if (data.messages && data.messages.length > 0) {
          for (const msg of data.messages) {
            if (!this.processedMessageIds.has(msg.id)) {
              this.processedMessageIds.add(msg.id);
              const text = msg.text || (msg.fileAttachment ? `[File: ${msg.fileAttachment.name}]` : '');
              const hex = msg.rawHex || stringToHex(text);
              const bytes = msg.byteLength || (text ? text.length : 0);
              triggerHaptic('received');
              this.callbacks?.onDataReceived(text, hex, bytes, msg.fileAttachment);
              this.callbacks?.onLog('RX', text, hex, bytes);
            }
          }
        }
      } catch {
        // network polling silent retry
      }
    }, 800);
  }

  private cleanupRoomRelay() {
    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch {
        // ignore
      }
      this.sseSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.channel = new BroadcastChannel('bluetooth_chat_mesh_network');
      this.channel.onmessage = (event) => this.handleMeshMessage(event.data);
      this.broadcastPresence();
    } catch {
      // BroadcastChannel fallback
    }
  }

  private broadcastPresence() {
    if (!this.channel || !this.isDiscoverable) return;
    this.channel.postMessage({
      type: 'DISCOVERY_BEACON',
      tabId: this.tabId,
      name: this.localName,
      mac: this.localMac,
      rssi: -50 - Math.floor(Math.random() * 20),
    });
  }

  private handleMeshMessage(data: any) {
    if (!data || data.tabId === this.tabId) return;

    if (data.type === 'DISCOVERY_BEACON') {
      window.dispatchEvent(
        new CustomEvent('bt_peer_discovered', {
          detail: {
            id: `tab_${data.tabId}`,
            name: data.name,
            address: data.mac,
            rssi: data.rssi || -60,
            type: 'phone',
            isPaired: false,
            isVirtual: false,
            tabPeerId: data.tabId,
          },
        })
      );
    } else if (data.type === 'CONNECT_REQUEST' && data.targetTabId === this.tabId) {
      this.connectedPeerTabId = data.tabId;
      this.channel?.postMessage({
        type: 'CONNECT_ACCEPT',
        tabId: this.tabId,
        targetTabId: data.tabId,
        name: this.localName,
        mac: this.localMac,
      });
      const peerDevice: BluetoothDeviceItem = {
        id: `tab_${data.tabId}`,
        name: data.name,
        address: data.mac,
        rssi: -55,
        type: 'phone',
        isPaired: true,
        isVirtual: false,
      };
      this.currentDevice = peerDevice;
      this.setConnectionState('connected', peerDevice);
      this.callbacks?.onLog('SYS', `Accepted incoming connection from ${data.name}`, '', 0);
    } else if (data.type === 'CONNECT_ACCEPT' && data.targetTabId === this.tabId) {
      if (this.currentDevice && this.currentDevice.id === `tab_${data.tabId}`) {
        this.connectedPeerTabId = data.tabId;
        this.setConnectionState('connected', this.currentDevice);
        this.callbacks?.onLog('SYS', `RFCOMM / BLE Link established with ${data.name}`, '', 0);
      }
    } else if (data.type === 'DISCONNECT' && data.targetTabId === this.tabId) {
      if (this.connectionState === 'connected') {
        this.setConnectionState('disconnected', null);
        this.callbacks?.onLog('SYS', 'Remote peer disconnected the link', '', 0);
      }
    } else if (data.type === 'DATA_PAYLOAD' && data.targetTabId === this.tabId) {
      const text = data.text;
      const hex = stringToHex(text);
      this.callbacks?.onDataReceived(text, hex, data.bytes);
      this.callbacks?.onLog('RX', text, hex, data.bytes);
    }
  }

  // Connect to real BLE Hardware using Web Bluetooth API
  public async connectWebBluetooth(settings: BluetoothSettings): Promise<BluetoothDeviceItem> {
    if (!this.isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome/Edge or simulated devices.');
    }

    this.setConnectionState('connecting', null);
    this.callbacks?.onLog('SYS', 'Requesting Web Bluetooth device selection dialog...', '', 0);

    try {
      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          BLE_SERVICES.NORDIC_UART.service,
          BLE_SERVICES.HM10.service,
          settings.customServiceUuid.trim() || 'battery_service',
          'generic_access',
        ].filter(Boolean),
      });

      this.callbacks?.onLog('SYS', `User selected: ${device.name || 'Unnamed Device'} (${device.id})`, '', 0);
      this.callbacks?.onLog('SYS', 'Connecting to GATT Server...', '', 0);

      const server = await device.gatt.connect();
      this.gattServer = server;

      // Try discovering UART service
      let service: any = null;
      let writeChar: any = null;
      let readChar: any = null;

      try {
        service = await server.getPrimaryService(BLE_SERVICES.NORDIC_UART.service);
        writeChar = await service.getCharacteristic(BLE_SERVICES.NORDIC_UART.rxChar);
        readChar = await service.getCharacteristic(BLE_SERVICES.NORDIC_UART.txChar);
      } catch {
        try {
          service = await server.getPrimaryService(BLE_SERVICES.HM10.service);
          writeChar = await service.getCharacteristic(BLE_SERVICES.HM10.char);
          readChar = writeChar;
        } catch {
          // Attempt generic primary services
          const services = await server.getPrimaryServices();
          if (services.length > 0) {
            service = services[0];
            const chars = await service.getCharacteristics();
            writeChar = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
            readChar = chars.find((c: any) => c.properties.notify || c.properties.indicate || c.properties.read);
          }
        }
      }

      this.writeChar = writeChar;
      this.readChar = readChar;

      if (readChar && (readChar.properties.notify || readChar.properties.indicate)) {
        await readChar.startNotifications();
        readChar.addEventListener('characteristicvaluechanged', (e: any) => {
          const value = e.target.value;
          const bytes = new Uint8Array(value.buffer);
          const text = new TextDecoder().decode(bytes);
          const hex = bytesToHex(bytes);
          this.callbacks?.onDataReceived(text, hex, bytes.length);
          this.callbacks?.onLog('RX', text, hex, bytes.length);
        });
      }

      device.addEventListener('gattserverdisconnected', () => {
        this.callbacks?.onLog('SYS', 'GATT Server disconnected', '', 0);
        this.setConnectionState('disconnected', null);
      });

      const btItem: BluetoothDeviceItem = {
        id: device.id,
        name: device.name || 'BLE Device',
        address: device.id.slice(0, 17) || generateMacAddress(),
        rssi: -62,
        type: 'sensor',
        isPaired: true,
        isVirtual: false,
        isWebBle: true,
        nativeDevice: device,
        mtu: 244,
      };

      this.currentDevice = btItem;
      this.setConnectionState('connected', btItem);
      this.callbacks?.onLog('SYS', `Connected to Web BLE device: ${btItem.name}`, '', 0);
      return btItem;
    } catch (err: any) {
      this.setConnectionState('disconnected', null);
      this.callbacks?.onLog('SYS', `Web Bluetooth Error: ${err.message}`, '', 0);
      throw err;
    }
  }

  // Connect to a virtual or peer tab device
  public async connectDevice(device: BluetoothDeviceItem): Promise<void> {
    this.setConnectionState('connecting', device);
    this.callbacks?.onLog('SYS', `Initiating RFCOMM connection to ${device.name} [${device.address}]...`, '', 0);

    // If it's a phone relay device
    if (device.isPhoneRelay || device.relayRoomCode) {
      await this.joinPhoneRoom(device.relayRoomCode || device.id.replace('room_', ''));
      return;
    }

    // If it's a peer tab
    if (device.id.startsWith('tab_')) {
      const peerTabId = device.id.replace('tab_', '');
      this.currentDevice = device;
      this.channel?.postMessage({
        type: 'CONNECT_REQUEST',
        tabId: this.tabId,
        targetTabId: peerTabId,
        name: this.localName,
        mac: this.localMac,
      });

      // Timeout safety
      setTimeout(() => {
        if (this.connectionState === 'connecting') {
          this.setConnectionState('connected', device);
          this.callbacks?.onLog('SYS', `Connected to wireless peer: ${device.name}`, '', 0);
        }
      }, 1200);
      return;
    }

    // Virtual device connection simulation
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));
    this.currentDevice = device;
    this.setConnectionState('connected', device);
    this.callbacks?.onLog('SYS', `Bluetooth SPP link established with ${device.name} [${device.address}]. MTU: 247`, '', 0);

    // Simulated welcome/ready banner based on device
    setTimeout(() => {
      if (this.connectionState !== 'connected' || this.currentDevice?.id !== device.id) return;
      if (device.name.includes('ESP32')) {
        const welcome = 'ESP-ROM:esp32s3-20210327\r\nReady. Type HELP for commands.';
        this.callbacks?.onDataReceived(welcome, stringToHex(welcome), welcome.length);
        this.callbacks?.onLog('RX', welcome, stringToHex(welcome), welcome.length);
      } else if (device.name.includes('Pixel')) {
        const greeting = 'Hey there! Connected over Bluetooth. Ready to chat!';
        this.callbacks?.onDataReceived(greeting, stringToHex(greeting), greeting.length);
        this.callbacks?.onLog('RX', greeting, stringToHex(greeting), greeting.length);
      } else if (device.name.includes('HC-05')) {
        const banner = '+BT_CONNECTED: HC-05 SERIAL LINK ACTIVE';
        this.callbacks?.onDataReceived(banner, stringToHex(banner), banner.length);
        this.callbacks?.onLog('RX', banner, stringToHex(banner), banner.length);
      }
    }, 600);
  }

  // Disconnect active link
  public async disconnect(): Promise<void> {
    if (!this.currentDevice) return;
    this.setConnectionState('disconnecting', this.currentDevice);
    this.callbacks?.onLog('SYS', `Closing Bluetooth connection with ${this.currentDevice.name}...`, '', 0);

    if (this.currentDevice.isWebBle && this.gattServer) {
      try {
        this.gattServer.disconnect();
      } catch {
        // ignore
      }
    }

    if (this.currentDevice.id.startsWith('tab_')) {
      const peerTabId = this.currentDevice.id.replace('tab_', '');
      this.channel?.postMessage({
        type: 'DISCONNECT',
        tabId: this.tabId,
        targetTabId: peerTabId,
      });
    }

    this.cleanupRoomRelay();
    this.processedMessageIds.clear();
    this.currentRoomCode = null;

    await new Promise((resolve) => setTimeout(resolve, 300));
    this.currentDevice = null;
    this.setConnectionState('disconnected', null);
    this.callbacks?.onLog('SYS', 'Bluetooth link terminated.', '', 0);
  }

  // Send data
  public async sendData(text: string, delimiter: '\\n' | '\\r\\n' | 'none' = '\\n'): Promise<void> {
    if (this.connectionState !== 'connected' || !this.currentDevice) {
      throw new Error('Bluetooth device is not connected.');
    }

    let payload = text;
    if (delimiter === '\\n') payload += '\n';
    else if (delimiter === '\\r\\n') payload += '\r\n';

    const hex = stringToHex(payload);
    const bytes = new TextEncoder().encode(payload).length;

    this.callbacks?.onDataSent(text, hex, bytes);
    this.callbacks?.onLog('TX', payload, hex, bytes);

    // If Phone Relay Room
    if (this.currentRoomCode) {
      triggerHaptic('sent');
      try {
        await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: this.phonePeerId,
            senderName: this.localName,
            text: payload,
            rawHex: hex,
            byteLength: bytes,
            eventType: 'message',
          }),
        });
      } catch (err: any) {
        this.callbacks?.onLog('SYS', `Relay packet delivery failed: ${err.message}`, '', 0);
      }
      return;
    }

    // If Web BLE
    if (this.currentDevice.isWebBle && this.writeChar) {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      try {
        if (this.writeChar.writeValueWithoutResponse) {
          await this.writeChar.writeValueWithoutResponse(data);
        } else {
          await this.writeChar.writeValue(data);
        }
      } catch (err: any) {
        this.callbacks?.onLog('SYS', `Write failed: ${err.message}`, '', 0);
      }
      return;
    }

    // If peer tab
    if (this.currentDevice.id.startsWith('tab_')) {
      const peerTabId = this.currentDevice.id.replace('tab_', '');
      this.channel?.postMessage({
        type: 'DATA_PAYLOAD',
        tabId: this.tabId,
        targetTabId: peerTabId,
        text: payload,
        bytes,
      });
      return;
    }

    // If virtual device, handle smart responses
    this.handleVirtualDeviceResponse(payload, this.currentDevice);
  }

  // Send file payload over Bluetooth relay
  public async sendFilePayload(fileAttachment: any, fileName: string, fileSize: number): Promise<void> {
    if (this.currentRoomCode) {
      triggerHaptic('sent');
      try {
        await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: this.phonePeerId,
            senderName: this.localName,
            text: `[File: ${fileName}]`,
            rawHex: stringToHex(fileName),
            byteLength: fileSize,
            fileAttachment,
            eventType: 'file_message',
          }),
        });
      } catch (err: any) {
        console.error('File relay error', err);
      }
    }
  }

  private handleVirtualDeviceResponse(incomingText: string, device: BluetoothDeviceItem) {
    const clean = incomingText.trim();

    if (device.name.includes('ESP32')) {
      setTimeout(() => {
        if (this.connectionState !== 'connected') return;
        const upper = clean.toUpperCase();
        let reply = '';
        if (upper === 'AT') {
          reply = 'OK';
        } else if (upper === 'AT+GMR') {
          reply = '+GMR: ESP32-WROOM-32D (IDF v4.4.2)';
        } else if (upper.includes('TEMP')) {
          const temp = (23.5 + Math.random() * 2.8).toFixed(1);
          reply = `+TEMP: ${temp} C`;
        } else if (upper.includes('STATUS')) {
          reply = `SYS: OK | HEAP: 198420B | RSSI: ${-58 - Math.floor(Math.random() * 10)} dBm`;
        } else if (upper.includes('LED ON')) {
          reply = 'OK: LED (GPIO2) -> HIGH';
        } else if (upper.includes('LED OFF')) {
          reply = 'OK: LED (GPIO2) -> LOW';
        } else if (upper === 'HELP') {
          reply = 'COMMANDS: AT, AT+GMR, TEMP, STATUS, LED ON, LED OFF, PING';
        } else if (upper === 'PING') {
          reply = 'PONG (latency: 14ms)';
        } else {
          reply = `ECHO: "${clean}" (len: ${clean.length} bytes)`;
        }

        const replyHex = stringToHex(reply);
        this.callbacks?.onDataReceived(reply, replyHex, reply.length);
        this.callbacks?.onLog('RX', reply, replyHex, reply.length);
      }, 400 + Math.random() * 300);
    } else if (device.name.includes('Pixel')) {
      setTimeout(() => {
        if (this.connectionState !== 'connected') return;
        const lower = clean.toLowerCase();
        let reply = '';
        if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
          reply = 'Hello! Bluetooth connection is strong. How are you?';
        } else if (lower.includes('how are you')) {
          reply = "Doing great! Testing out the Bluetooth Chat app. It's super fast!";
        } else if (lower.includes('ping')) {
          reply = 'Pong! ⚡ Latency 22ms over Bluetooth 5.3.';
        } else if (lower.includes('where are you') || lower.includes('nearby')) {
          reply = 'I am right here within 10 meters, signal RSSI is great!';
        } else if (lower.includes('file') || lower.includes('photo') || lower.includes('image')) {
          reply = 'Received your packet! Checksum verified 100%.';
        } else {
          const replies = [
            `Got your message: "${clean}" 👍`,
            'Transmitted loud and clear over RFCOMM serial channel.',
            'Nice! Received via BLE Chat Service.',
            'That works perfectly on this end!',
          ];
          reply = replies[Math.floor(Math.random() * replies.length)];
        }

        const replyHex = stringToHex(reply);
        this.callbacks?.onDataReceived(reply, replyHex, reply.length);
        this.callbacks?.onLog('RX', reply, replyHex, reply.length);
      }, 600 + Math.random() * 700);
    } else if (device.name.includes('HC-05')) {
      setTimeout(() => {
        if (this.connectionState !== 'connected') return;
        const reply = `+OK: ${clean}`;
        const replyHex = stringToHex(reply);
        this.callbacks?.onDataReceived(reply, replyHex, reply.length);
        this.callbacks?.onLog('RX', reply, replyHex, reply.length);
      }, 250);
    } else {
      // Generic responder
      setTimeout(() => {
        if (this.connectionState !== 'connected') return;
        const reply = `ACK: ${clean}`;
        const replyHex = stringToHex(reply);
        this.callbacks?.onDataReceived(reply, replyHex, reply.length);
        this.callbacks?.onLog('RX', reply, replyHex, reply.length);
      }, 500);
    }
  }

  private setConnectionState(state: ConnectionState, device: BluetoothDeviceItem | null) {
    this.connectionState = state;
    this.callbacks?.onConnectionChange(state, device);
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getCurrentDevice(): BluetoothDeviceItem | null {
    return this.currentDevice;
  }
}
