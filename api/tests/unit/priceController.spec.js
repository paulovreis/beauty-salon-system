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
    // Margem de lucro: Preço = Custo / (1 - Margem/100)
    // 100 / (1 - 0.25) = 100 / 0.75 = 133.33
    expect(res.body.price).toBe(133.33);
  });

  it('calculates price correctly with high margin (99%)', () => {
    const req = { body: { base_cost: 50, profit_margin: 99 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(200);
    // Margem de lucro: Preço = Custo / (1 - Margem/100)
    // 50 / (1 - 0.99) = 50 / 0.01 = 5000
    expect(res.body.price).toBe(5000);
  });

  it('calculates price correctly with 20% margin', () => {
    const req = { body: { base_cost: 15, profit_margin: 20 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(200);
    // Margem de lucro: Preço = Custo / (1 - Margem/100)
    // 15 / (1 - 0.20) = 15 / 0.80 = 18.75
    expect(res.body.price).toBe(18.75);
  });

  it('rejects invalid input', () => {
    const req = { body: { base_cost: 'x', profit_margin: 25 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects margin >= 100%', () => {
    const req = { body: { base_cost: 50, profit_margin: 100 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Margem de lucro deve ser menor que 100%');
  });

  it('rejects negative margin', () => {
    const req = { body: { base_cost: 50, profit_margin: -10 } };
    const res = makeRes();
    PriceController.calculate(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Margem de lucro não pode ser negativa');
  });
});
