const express = require('express');
const service = require('./products.service');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../lib/validate');
const { createProductSchema, updateProductSchema, adjustStockSchema, categorySchema } = require('../../lib/schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try {
    res.json(service.list(req.query));
  } catch (err) { next(err); }
});

router.get('/categories', (req, res, next) => {
  try {
    res.json({ data: service.listCategories() });
  } catch (err) { next(err); }
});

router.post('/categories', validateBody(categorySchema), (req, res, next) => {
  try {
    res.status(201).json({ data: service.createCategory(req.body.name) });
  } catch (err) { next(err); }
});

router.patch('/categories/:id', validateBody(categorySchema), (req, res, next) => {
  try {
    res.json({ data: service.renameCategory(req.params.id, req.body.name) });
  } catch (err) { next(err); }
});

router.delete('/categories/:id', (req, res, next) => {
  try {
    res.json({ data: service.deleteCategory(req.params.id) });
  } catch (err) { next(err); }
});

router.get('/low-stock', (req, res, next) => {
  try {
    res.json({ data: service.lowStock() });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    res.json({ data: service.getById(req.params.id) });
  } catch (err) { next(err); }
});

router.get('/:id/stock-movements', (req, res, next) => {
  try {
    res.json({ data: service.getStockMovements(req.params.id) });
  } catch (err) { next(err); }
});

router.get('/:id/stat', (req, res, next) => {
  try {
    res.json({ data: service.getProductStat(req.params.id, req.query) });
  } catch (err) { next(err); }
});

router.post('/', validateBody(createProductSchema), (req, res, next) => {
  try {
    res.status(201).json({ data: service.create(req.body) });
  } catch (err) { next(err); }
});

router.patch('/:id', validateBody(updateProductSchema), (req, res, next) => {
  try {
    res.json({ data: service.update(req.params.id, req.body) });
  } catch (err) { next(err); }
});

router.patch('/:id/stock', validateBody(adjustStockSchema), (req, res, next) => {
  try {
    const { delta, note } = req.body;
    res.json({ data: service.adjustStock(req.params.id, delta, note) });
  } catch (err) { next(err); }
});

module.exports = router;
