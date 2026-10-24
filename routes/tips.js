const express = require('express');
const router = express.Router();

const { TIPS } = require('../app/data/tips');

router.get('/', (req, res) => res.redirect('/tips/' + TIPS[0].slug));

router.get('/:slug', (req, res) => {
  const tip = TIPS.find(t => t.slug === req.params.slug);
  if (!tip) return res.status(404).send('Không tìm thấy bài viết');
  res.render('tips/detail', {
    title: tip.title,
    tip,
    others: TIPS.filter(t => t.slug !== tip.slug)
  });
});

module.exports = router;
