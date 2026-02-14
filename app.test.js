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
  test('should work with a complete analysis object', () => {
    const analysis = {
      productName: '智能手表',
      category: '电子产品',
      features: ['续航强', '防水', '心率监测'],
      scene1: '户外运动',
      scene1Desc: '在阳光下的跑道上',
      scene2: '日常办公',
      scene2Desc: '在办公桌前配合笔记本电脑',
      sceneKeyword: '运动与办公'
    };

    const results = buildResultTypes(analysis);

    expect(results).toHaveLength(7);
    expect(results[0].type).toBe('白底主图');
    expect(results[0].prompt).toContain('智能手表');
    expect(results[0].prompt).toContain('电子产品');
    expect(results[0].prompt).toContain('续航强、防水、心率监测');

    expect(results[1].type).toBe('场景主图 · 户外运动');
    // The prompt uses scene1Desc and sceneKeyword, not necessarily scene1 name
    expect(results[1].prompt).toContain('在阳光下的跑道上');
    expect(results[1].prompt).toContain('运动与办公');
  });

  test('should work with an empty object', () => {
    const results = buildResultTypes({});

    expect(results).toHaveLength(7);
    expect(results[0].type).toBe('白底主图');
    expect(results[0].prompt).toContain('产品'); // Default
    expect(results[0].prompt).toContain('优质设计'); // Default features

    expect(results[1].type).toBe('场景主图 · 生活场景'); // Default scene1
    expect(results[1].prompt).toContain('现代温馨明亮的居家环境中'); // Default scene1Desc
  });

  test('should work with null or undefined', () => {
    // These should now work because of the default parameter analysis = {}
    const resultsNull = buildResultTypes(null);
    expect(resultsNull).toHaveLength(7);
    expect(resultsNull[0].prompt).toContain('产品');

    const resultsUndefined = buildResultTypes(undefined);
    expect(resultsUndefined).toHaveLength(7);
    expect(resultsUndefined[0].prompt).toContain('产品');
  });

  test('should handle partial analysis data', () => {
    const analysis = {
      productName: '咖啡机',
      features: ['快速加热']
      // missing other fields
    };

    const results = buildResultTypes(analysis);

    expect(results).toHaveLength(7);
    expect(results[0].prompt).toContain('咖啡机');
    expect(results[0].prompt).toContain('快速加热');
    expect(results[0].prompt).toContain('产品'); // category default

    // scene1 should use default
    expect(results[1].type).toBe('场景主图 · 生活场景');
  });

  test('should handle empty features array', () => {
    const analysis = {
      productName: '风扇',
      features: []
    };

    const results = buildResultTypes(analysis);
    expect(results[0].prompt).toContain('优质设计'); // Default when features joined is empty
  });

  test('should handle features being a non-array (robustness)', () => {
    const analysis = {
      features: "not an array"
    };
    // Should not throw, should treat as empty array
    const results = buildResultTypes(analysis);
    expect(results).toHaveLength(7);
    expect(results[0].prompt).toContain('优质设计');
  });

  test('should use DEMO_IMAGES for all types', () => {
    const results = buildResultTypes({});

    expect(results[0].image).toBe(DEMO_IMAGES.original);
    expect(results[1].image).toBe(DEMO_IMAGES.scene);
    expect(results[2].image).toBe(DEMO_IMAGES.scene);
    expect(results[3].image).toBe(DEMO_IMAGES.sellingPoint);
    expect(results[4].image).toBe(DEMO_IMAGES.sellingPoint);
    expect(results[5].image).toBe(DEMO_IMAGES.structure);
    expect(results[6].image).toBe(DEMO_IMAGES.original);
  });
});
