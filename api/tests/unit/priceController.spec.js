import PriceController from '../../src/controllers/priceController.js';

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code){ this.statusCode = code; return this; },
    json(payload){ this.body = payload; return this; }
  };
}

describe('PriceController.calculate', () => {
  it('calculates price correctly', () => {
    const req = { body: { base_cost: 100, profit_margin: 25 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(125.00);
  });

  it('rejects invalid input', () => {
    const req = { body: { base_cost: 'x', profit_margin: 25 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(400);
  });
});
