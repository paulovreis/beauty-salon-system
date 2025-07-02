class PriceController {
  calculate(req, res) {
    const { base_cost, profit_margin } = req.body;
    if (typeof base_cost !== 'number' || typeof profit_margin !== 'number') {
      return res.status(400).json({ message: 'Custo base e margem de lucro devem ser números' });
    }
    const price = Number(base_cost) + (Number(base_cost) * Number(profit_margin) / 100);
    res.json({ price: Number(price.toFixed(2)) });
  }
}

export default new PriceController();
