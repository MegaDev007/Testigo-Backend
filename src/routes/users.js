import { Router } from 'express';

const router = Router();
const Controller = require('../controller/user.controller');
const { getList, getOne, update, deleteOne, create, getProfile } = Controller;

router.get('/', getList);
router.get('/profile', getProfile);
router.post('/', create);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', deleteOne);

export default router;
