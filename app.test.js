// Mock browser globals before requiring app.js
global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
};
const mockElement = {
  addEventListener: jest.fn(),
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    contains: jest.fn(() => false),
  },
  scrollIntoView: jest.fn(),
  click: jest.fn(),
  style: {},
  dataset: {},
  appendChild: jest.fn(),
  getAttribute: jest.fn(() => ''),
  getBoundingClientRect: jest.fn(() => ({ top: 0 })),
};

global.document = {
  getElementById: jest.fn(() => mockElement),
  querySelectorAll: jest.fn(() => []),
  addEventListener: jest.fn(),
  body: { style: {} },
};
global.window = {
  addEventListener: jest.fn(),
};
global.IntersectionObserver = class {
  constructor() {}
  observe() {}
};
global.FileReader = class {
  readAsDataURL() {}
};

const { buildResultTypes, DEMO_IMAGES } = require('./app.js');

describe('buildResultTypes', () => {
  test('should work with a complete analysis object (no KB match)', () => {
    const analysis = {
      productName: '智能手表',
      category: '电子产品',
    };

    const results = buildResultTypes(analysis);

    // 无 KB 匹配时：白底主图 + 结构图 + 45°角 = 3 固定 + 2 场景(fallback空) + 2 卖点(fallback)
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].type).toBe('白底主图');
    expect(results[0].prompt).toContain('智能手表');
  });

  test('should work with an empty object', () => {
    const results = buildResultTypes({});

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].type).toBe('白底主图');
    expect(results[0].prompt).toContain('产品'); // Default
  });

  test('should work with null or undefined', () => {
    const resultsNull = buildResultTypes(null);
    expect(resultsNull.length).toBeGreaterThanOrEqual(3);
    expect(resultsNull[0].prompt).toContain('产品');

    const resultsUndefined = buildResultTypes(undefined);
    expect(resultsUndefined.length).toBeGreaterThanOrEqual(3);
    expect(resultsUndefined[0].prompt).toContain('产品');
  });

  test('should handle partial analysis data', () => {
    const analysis = {
      productName: '咖啡机',
    };

    const results = buildResultTypes(analysis);

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].prompt).toContain('咖啡机');
  });

  test('should use DEMO_IMAGES for white background type', () => {
    const results = buildResultTypes({});
    expect(results[0].image).toBe(DEMO_IMAGES.original);
  });

  test('should always have white background and 45-degree angle results', () => {
    const results = buildResultTypes({});
    const types = results.map(r => r.type);
    expect(types).toContain('白底主图');
    expect(types).toContain('白底主图 · 45°角');
  });

  test('should always have structure diagram', () => {
    const results = buildResultTypes({});
    const types = results.map(r => r.type);
    expect(types.some(t => t.includes('结构图'))).toBe(true);
  });
});
