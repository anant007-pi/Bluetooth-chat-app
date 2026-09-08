export interface PhoneInfo {
  os: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown';
  osVersion: string;
  deviceModel: string;
  browser: 'Safari' | 'Chrome' | 'Edge' | 'Firefox' | 'Samsung Internet' | 'Opera' | 'Bluefy' | 'Other';
  isMobile: boolean;
  isIos: boolean;
  isAndroid: boolean;
  hasWebBluetooth: boolean;
  hasVibration: boolean;
  hasWakeLock: boolean;
  hasWebShare: boolean;
  hasAudio: boolean;
}

export function detectPhoneInfo(): PhoneInfo {
  if (typeof window === 'undefined') {
    return {
      os: 'Unknown',
      osVersion: '',
      deviceModel: 'Generic Device',
      browser: 'Other',
      isMobile: false,
      isIos: false,
      isAndroid: false,
      hasWebBluetooth: false,
      hasVibration: false,
      hasWakeLock: false,
      hasWebShare: false,
      hasAudio: false,
    };
  }

  const ua = navigator.userAgent || '';
  const isIpad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIphone = /iPhone|iPod/i.test(ua);
  const isIos = isIphone || isIpad;
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIos || isAndroid || /Mobile/i.test(ua);

  let os: PhoneInfo['os'] = 'Unknown';
  let osVersion = '';
  if (isIos) {
    os = 'iOS';
    const match = ua.match(/OS (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace('_', '.');
  } else if (isAndroid) {
    os = 'Android';
    const match = ua.match(/Android\s([0-9.]+)/);
    if (match) osVersion = match[1];
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Detect specific phone models
  let deviceModel = 'Mobile Phone';
  if (isIphone) {
    deviceModel = 'iPhone';
    // Screen dimension hints
    const w = window.screen.width;
    const h = window.screen.height;
    if (w >= 430 || h >= 932) deviceModel = 'iPhone Pro Max';
    else if (w >= 393 || h >= 852) deviceModel = 'iPhone 15/16 Pro';
    else if (w >= 390 || h >= 844) deviceModel = 'iPhone 13/14';
    else deviceModel = 'Apple iPhone';
  } else if (isIpad) {
    deviceModel = 'Apple iPad';
  } else if (isAndroid) {
    if (/SM-|SAMSUNG/i.test(ua)) {
      deviceModel = 'Samsung Galaxy';
      const m = ua.match(/SM-([A-Za-z0-9]+)/);
      if (m) deviceModel = `Samsung Galaxy (${m[1]})`;
    } else if (/Pixel/i.test(ua)) {
      deviceModel = 'Google Pixel';
      const m = ua.match(/Pixel\s?([0-9a-zA-Z\s]+)/);
      if (m) deviceModel = `Pixel ${m[1].split(' ')[0]}`;
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
      deviceModel = 'Xiaomi Phone';
    } else if (/OnePlus/i.test(ua)) {
      deviceModel = 'OnePlus Phone';
    } else {
      deviceModel = 'Android Phone';
    }
  } else {
    deviceModel = os === 'macOS' ? 'MacBook' : os === 'Windows' ? 'Windows PC' : 'Computer';
  }

  // Browser detection
  let browser: PhoneInfo['browser'] = 'Other';
  if (/Bluefy/i.test(ua)) {
    browser = 'Bluefy';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/EdgA|EdgiOS|Edge/i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'Firefox';
  } else if (/CriOS|Chrome/i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  }

  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const hasVibration = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const hasWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const hasWebShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const hasAudio = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);

  return {
    os,
    osVersion,
    deviceModel,
    browser,
    isMobile,
    isIos,
    isAndroid,
    hasWebBluetooth,
    hasVibration,
    hasWakeLock,
    hasWebShare,
    hasAudio,
  };
}

// Trigger haptic pulse safely on phones supporting vibration
export function triggerHaptic(type: 'tap' | 'sent' | 'received' | 'connected' | 'error' | 'disconnected') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'tap':
        navigator.vibrate(15);
        break;
      case 'sent':
        navigator.vibrate(25);
        break;
      case 'received':
        navigator.vibrate([40, 30, 40]);
        break;
      case 'connected':
        navigator.vibrate([60, 40, 80]);
        break;
      case 'disconnected':
        navigator.vibrate([40, 60]);
        break;
      case 'error':
        navigator.vibrate([80, 50, 80]);
        break;
    }
  } catch {
    // Ignore vibration failures (e.g. user hasn't interacted yet)
  }
}

// Keep screen awake while chatting
let wakeLockSentinel: any = null;
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return false;
  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch {
    return false;
  }
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch {
      // ignore
    }
    wakeLockSentinel = null;
  }
}

export async function requestWakeLock(): Promise<() => void> {
  await requestScreenWakeLock();
  return () => {
    releaseScreenWakeLock();
  };
}
