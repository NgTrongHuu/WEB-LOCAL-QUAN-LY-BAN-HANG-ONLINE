const express = require('express');
const service = require('./orders.service');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../lib/validate');
const { createOrderSchema } = require('../../lib/schemas');
const db = require('../../db/connection');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try { res.json(service.list(req.query)); } catch (err) { next(err); }
});

router.get('/channels', (req, res, next) => {
  try { res.json({ data: db.prepare('SELECT * FROM channels ORDER BY name').all() }); } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try { res.json({ data: service.getOrderWithItems(req.params.id) }); } catch (err) { next(err); }
});

router.post('/', validateBody(createOrderSchema), (req, res, next) => {
  try { res.status(201).json({ data: service.createOrder(req.body) }); } catch (err) { next(err); }
});

router.post('/:id/complete', (req, res, next) => {
  try { res.json({ data: service.completeOrder(req.params.id) }); } catch (err) { next(err); }
});

router.post('/:id/cancel', (req, res, next) => {
  try { res.json({ data: service.cancelOrder(req.params.id) }); } catch (err) { next(err); }
});

module.exports = router;
