const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/capture-anchors.js'), 'utf8');

function fixture() {
    const context = { innerWidth: 400, innerHeight: 800, scrollY: 0 };
    const image = {
        top: 1000, height: 2000, isConnected: true, src: 'https://example.test/page.jpg',
        getBoundingClientRect() { return { top: this.top - context.scrollY, bottom: this.top + this.height - context.scrollY, height: this.height }; }
    };
    const images = [image];
    context.window = context;
    context.document = { querySelectorAll: () => images, elementFromPoint: () => image };
    vm.createContext(context);
    vm.runInContext(source, context);
    function mark() {
        context.scrollY = 800; context.MangaCaptureAnchors.mark('start');
        context.scrollY = 2400; context.MangaCaptureAnchors.mark('end');
    }
    return { context, image, images, mark, positions: () => Array.from(context.MangaCaptureAnchors.resolve(1200)) };
}

test('uses the same selected content after scrolling', () => {
    const f = fixture(); f.mark(); f.context.scrollY = 0;
    assert.deepEqual(f.positions(), [3600, 8400]);
});
test('follows content when images or advertisements above it change height', () => {
    const f = fixture(); f.mark(); f.image.top += 275;
    assert.deepEqual(f.positions(), [4425, 9225]);
});
test('preserves fractional positions inside a resized manga image', () => {
    const f = fixture(); f.mark(); f.image.height = 3000;
    assert.deepEqual(f.positions(), [3900, 11100]);
});
test('viewport height changes do not change CSS to native scale', () => {
    const f = fixture(); f.mark(); f.context.innerHeight = 750;
    assert.deepEqual(f.positions(), [3600, 8400]);
});
test('recovers a replaced image with the same source', () => {
    const f = fixture(); f.mark(); f.image.isConnected = false;
    f.images[0] = { ...f.image, isConnected: true, top: 1100 };
    assert.deepEqual(f.positions(), [3900, 8700]);
});
test('rejects removed content and reversed selection', () => {
    const f = fixture(); f.mark(); f.image.isConnected = false; f.images.length = 0;
    assert.throws(() => f.positions(), /removed/);
    const g = fixture(); g.context.scrollY = 2000; g.context.MangaCaptureAnchors.mark('start');
    g.context.scrollY = 1000; g.context.MangaCaptureAnchors.mark('end');
    assert.throws(() => g.positions(), /Invalid/);
});
test('selecting a new start invalidates the old end', () => {
    const f = fixture(); f.mark(); f.context.MangaCaptureAnchors.mark('start');
    assert.throws(() => f.positions(), /Missing/);
});
