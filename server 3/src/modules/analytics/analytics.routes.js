const express = require('express');
const service = require('./analytics.service');
const { requireAuth } = require('../../middleware/auth');
const productsService = require('../products/products.service');

const router = express.Router();
router.use(requireAuth);

router.get('/overview', (req, res, next) => {
  try { res.json({ data: service.overview(req.query) }); } catch (err) { next(err); }
});
router.get('/top-products', (req, res, next) => {
  try { res.json({ data: service.topProducts(req.query) }); } catch (err) { next(err); }
});
router.get('/returns', (req, res, next) => {
  try { res.json({ data: service.returnsAnalysis(req.query) }); } catch (err) { next(err); }
});
router.get('/channels', (req, res, next) => {
  try { res.json({ data: service.channels(req.query) }); } catch (err) { next(err); }
});
router.get('/customers', (req, res, next) => {
  try { res.json({ data: service.customersTrend(req.query) }); } catch (err) { next(err); }
});
router.get('/low-stock', (req, res, next) => {
  try { res.json({ data: productsService.lowStock() }); } catch (err) { next(err); }
});

module.exports = router;
