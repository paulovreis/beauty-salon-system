class PriceController {
  calculate(req, res) {
    const { base_cost, profit_margin } = req.body;
    if (typeof base_cost !== 'number' || typeof profit_margin !== 'number') {
      return res.status(400).json({ message: 'Custo base e margem de lucro devem ser números' });
    }
    // Validar margem de lucro (deve ser < 100%)
    if (profit_margin >= 100) {
      return res.status(400).json({ message: 'Margem de lucro deve ser menor que 100%' });
    }
    if (profit_margin < 0) {
      return res.status(400).json({ message: 'Margem de lucro não pode ser negativa' });
    }
    // Fórmula correta da margem de lucro: Preço = Custo / (1 - Margem/100)
    // Margem = (Preço - Custo) / Preço × 100
    const price = Number(base_cost) / (1 - (Number(profit_margin) / 100));
    res.json({ price: Number(price.toFixed(2)) });
  }
}

export default new PriceController();
