const express = require('express');
const service = require('./returns.service');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../lib/validate');
const { createReturnSchema } = require('../../lib/schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try { res.json(service.list(req.query)); } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try { res.json({ data: service.getReturnWithItems(req.params.id) }); } catch (err) { next(err); }
});

router.post('/', validateBody(createReturnSchema), (req, res, next) => {
  try { res.status(201).json({ data: service.createReturn(req.body) }); } catch (err) { next(err); }
});

module.exports = router;
