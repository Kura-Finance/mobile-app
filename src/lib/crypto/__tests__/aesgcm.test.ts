import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import {
  AES_GCM_IV_BYTES,
  AES_GCM_TAG_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
  unpackIvCtTag,
  unpackIvTagCt,
} from '../aesgcm';
import { bytesToHex, hexToBytes } from '../encoding';

describe('AES-256-GCM', () => {
  // NIST CAVS-style mini vector — round trip with a fixed key/iv.
  test('encrypt → decrypt round trip', () => {
    const key = hexToBytes('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');
    const iv = hexToBytes('000102030405060708090a0b');
    const plaintext = hexToBytes('feedfacedeadbeef');
    const ctTag = aesGcmEncrypt(key, iv, plaintext);
    expect(ctTag.length).toBe(plaintext.length + AES_GCM_TAG_BYTES);
    const recovered = aesGcmDecrypt(key, iv, ctTag);
    expect(bytesToHex(recovered)).toBe(bytesToHex(plaintext));
  });

  test('tampered tag fails decrypt', () => {
    const key = new Uint8Array(32).fill(0x42);
    const iv = new Uint8Array(AES_GCM_IV_BYTES).fill(0x01);
    const ctTag = aesGcmEncrypt(key, iv, new Uint8Array([1, 2, 3, 4]));
    ctTag[ctTag.length - 1] ^= 0x01;
    expect(() => aesGcmDecrypt(key, iv, ctTag)).toThrow();
  });

  test('iv | ct | tag layout unpacks correctly', () => {
    const iv = new Uint8Array(AES_GCM_IV_BYTES).fill(0x11);
    const ct = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const tag = new Uint8Array(AES_GCM_TAG_BYTES).fill(0x77);
    const packed = new Uint8Array(iv.length + ct.length + tag.length);
    packed.set(iv, 0);
    packed.set(ct, iv.length);
    packed.set(tag, iv.length + ct.length);

    const { iv: ivOut, ciphertextWithTag } = unpackIvCtTag(packed);
    expect(bytesToHex(ivOut)).toBe(bytesToHex(iv));
    expect(ciphertextWithTag.length).toBe(ct.length + tag.length);
    expect(Array.from(ciphertextWithTag.slice(0, ct.length))).toEqual(Array.from(ct));
    expect(Array.from(ciphertextWithTag.slice(ct.length))).toEqual(Array.from(tag));
  });

  test('iv | tag | ct layout re-orders to ct | tag', () => {
    const iv = new Uint8Array(AES_GCM_IV_BYTES).fill(0x22);
    const ct = new Uint8Array([0x10, 0x20, 0x30]);
    const tag = new Uint8Array(AES_GCM_TAG_BYTES).fill(0x88);
    const packed = new Uint8Array(iv.length + tag.length + ct.length);
    packed.set(iv, 0);
    packed.set(tag, iv.length);
    packed.set(ct, iv.length + tag.length);

    const { iv: ivOut, ciphertextWithTag } = unpackIvTagCt(packed);
    expect(bytesToHex(ivOut)).toBe(bytesToHex(iv));
    expect(Array.from(ciphertextWithTag.slice(0, ct.length))).toEqual(Array.from(ct));
    expect(Array.from(ciphertextWithTag.slice(ct.length))).toEqual(Array.from(tag));
  });
});
