// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom には TextEncoder/TextDecoder がないため Node 実装で補う
// （CSV 取り込みの Shift_JIS 判定テストで使用。Node は full-icu 前提）
import { TextDecoder, TextEncoder } from 'util';
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
