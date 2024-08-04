import { Router } from 'express';

const router = Router();
const Controller = require('../controller/shopify.controller');
const { getProductData } = Controller;

router.post('/', getProductData);
// router.get('/profile', getProfile);
// router.post('/', create);
// router.get('/:id', getOne);
// router.put('/:id', update);
// router.delete('/:id', deleteOne);

export default router;
