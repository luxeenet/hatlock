import { describe, it, expect } from 'vitest';
import { HardwareIdentitySchema, DEVICE_OS_LIST, DEVICE_TYPES } from '@hatlock/shared';

describe('Universal MDM & Device Security Tests', () => {
  it('should support universal OS and device type definitions', () => {
    expect(DEVICE_OS_LIST).toContain('WINDOWS');
    expect(DEVICE_OS_LIST).toContain('LINUX');
    expect(DEVICE_OS_LIST).toContain('ANDROID');
    expect(DEVICE_OS_LIST).toContain('IOS');
    expect(DEVICE_OS_LIST).toContain('MACOS');
    expect(DEVICE_OS_LIST).toContain('IPADOS');

    expect(DEVICE_TYPES).toContain('LAPTOP');
    expect(DEVICE_TYPES).toContain('DESKTOP');
    expect(DEVICE_TYPES).toContain('SMARTPHONE');
    expect(DEVICE_TYPES).toContain('TABLET');
  });

  it('should validate Windows hardware identity schema with TPM and Secure Boot', () => {
    const windowsHw = {
      serialNumber: '5CD2348ABC',
      systemUuid: 'c89283f5-7489-493e-a89a-0824b0b8db2c',
      manufacturer: 'HP',
      model: 'EliteBook 840 G8',
      deviceType: 'LAPTOP' as const,
      tpmPresent: true,
      tpmVersion: '2.0',
      secureBootEnabled: true,
      osType: 'WINDOWS' as const,
      osVersion: '10.0.22631',
      agentVersion: '1.0.0'
    };

    const parsed = HardwareIdentitySchema.safeParse(windowsHw);
    expect(parsed.success).toBe(true);
  });

  it('should validate Android smartphone identity with IMEI and Play Integrity', () => {
    const androidHw = {
      serialNumber: 'TECNO-CAMON30-PRO-001',
      systemUuid: 'android_id_abcdef123456',
      manufacturer: 'Tecno',
      model: 'Camon 30 Pro',
      deviceType: 'SMARTPHONE' as const,
      osType: 'ANDROID' as const,
      osVersion: '14.0',
      agentVersion: '1.0.0',
      imei1: '356892110293845',
      imei2: '356892110293846',
      androidId: 'abcdef1234567890',
      screenLockEnabled: true,
      playIntegrityVerdict: 'MEETS_STRONG_INTEGRITY'
    };

    const parsed = HardwareIdentitySchema.safeParse(androidHw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imei1).toBe('356892110293845');
      expect(parsed.data.playIntegrityVerdict).toBe('MEETS_STRONG_INTEGRITY');
    }
  });

  it('should validate Apple iPhone supervised MDM identity', () => {
    const appleHw = {
      serialNumber: 'F2LXW0ABCDEF',
      systemUuid: '00008030-001234567890002E',
      manufacturer: 'Apple',
      model: 'iPhone 15 Pro',
      deviceType: 'SMARTPHONE' as const,
      osType: 'IOS' as const,
      osVersion: '18.1',
      agentVersion: '1.0.0',
      appleUdid: '00008030-001234567890002E'
    };

    const parsed = HardwareIdentitySchema.safeParse(appleHw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.appleUdid).toBe('00008030-001234567890002E');
    }
  });

  it('should reject invalid hardware identity missing required serial number', () => {
    const invalidHw = {
      serialNumber: '',
      manufacturer: 'Samsung',
      model: 'Galaxy A15',
      deviceType: 'SMARTPHONE',
      osType: 'ANDROID'
    };

    const parsed = HardwareIdentitySchema.safeParse(invalidHw);
    expect(parsed.success).toBe(false);
  });
});
