const express = require('express');
const router = express.Router();
const supplyController = require('../app/controllers/supplyController');

router.get('/', supplyController.index);
router.get('/create', supplyController.createForm);
router.post('/', supplyController.store);
router.get('/:id/edit', supplyController.editForm);
router.put('/:id', supplyController.update);
router.post('/:id/adjust', supplyController.adjust);
router.delete('/:id', supplyController.destroy);

module.exports = router;