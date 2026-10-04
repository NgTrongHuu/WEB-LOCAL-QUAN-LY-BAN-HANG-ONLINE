const express = require('express');
const service = require('./feedback.service');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../lib/validate');
const { feedbackContactSchema, feedbackMessageSchema } = require('../../lib/schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/contacts', (req, res, next) => {
  try { res.json({ data: service.listContacts(req.query.search) }); } catch (err) { next(err); }
});

router.post('/contacts', validateBody(feedbackContactSchema), (req, res, next) => {
  try { res.status(201).json({ data: service.createContact(req.body.name) }); } catch (err) { next(err); }
});

router.get('/contacts/:id/messages', (req, res, next) => {
  try { res.json({ data: service.getMessages(req.params.id) }); } catch (err) { next(err); }
});

router.post('/contacts/:id/messages', validateBody(feedbackMessageSchema), (req, res, next) => {
  try {
    const { content, label } = req.body;
    res.status(201).json({ data: service.addMessage(req.params.id, content, label) });
  } catch (err) { next(err); }
});

module.exports = router;
