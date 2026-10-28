const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/capture-filename.js'), 'utf8');
function filename(headings, title = '') {
    const context = { TextEncoder, document: { title, querySelectorAll: () => headings.map(textContent => ({ textContent })) } };
    context.window = context;
    vm.createContext(context);vm.runInContext(source, context);
    return context.MangaCaptureFilename.create();
}
test('uses story and chapter heading over the generic site heading', () => {
    assert.equal(filename(['อ่านมังงะอ่านการ์ตูนออนไลน์แปลไทย 2026', 'Pig Slayer พิชิตโลกด้วยมีดเชือดหมู ก็สมเหตุสมผลใช่ไหม ตอนที่ 0 แปลไทย']), 'Pig Slayer พิชิตโลกด้วยมีดเชือดหมู ก็สมเหตุสมผลใช่ไหม ตอนที่ 0.pdf');
});
test('retains decimal chapters', () => {
    assert.equal(filename(['อ่านมังงะ Pig Slayer ตอนที่ 56.2 แปลไทย']), 'Pig Slayer ตอนที่ 56.2.pdf');
});
test('falls back to the page title with English chapter labels', () => {
    assert.equal(filename([], 'Sample Manga Chapter 12.5 | Go-Manga'), 'Sample Manga ตอนที่ 12.5.pdf');
});
test('retains Thai chapter digits and removes unsafe filename characters', () => {
    assert.equal(filename(['เรื่อง: A/B? ตอนที่ ๑๒ แปลไทย']), 'เรื่อง A B ตอนที่ ๑๒.pdf');
});
test('handles missing metadata', () => {
    assert.equal(filename([], ''), 'Manga.pdf');
});
test('limits UTF-8 bytes while preserving the chapter suffix', () => {
    const result = filename(['เรื่องยาว'.repeat(100) + ' ตอนที่ 123.4 แปลไทย']);
    assert.ok(Buffer.byteLength(result) <= 214);
    assert.ok(result.endsWith(' ตอนที่ 123.4.pdf'));
});
