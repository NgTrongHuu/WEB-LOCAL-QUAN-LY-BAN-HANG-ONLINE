const express = require('express');
const service = require('./cashbook.service');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../lib/validate');
const { cashManualSchema } = require('../../lib/schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res, next) => {
  try { res.json(service.list(req.query)); } catch (err) { next(err); }
});

router.get('/summary', (req, res, next) => {
  try { res.json({ data: service.summary(req.query) }); } catch (err) { next(err); }
});

router.post('/', validateBody(cashManualSchema), (req, res, next) => {
  try { res.status(201).json({ data: service.createManual(req.body) }); } catch (err) { next(err); }
});

module.exports = router;
