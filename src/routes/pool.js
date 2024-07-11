import { Router } from 'express';
import {
  getList,
  getOne,
  create,
  update,
  deleteOne,
  serveNumberPoolScript,
  assignNumber
} from '../controller/managepoolnumber.controller.js';

const router = Router();

router.get('/', getList);
router.get('/appengine/:poolId/number_pool.js', serveNumberPoolScript);
router.post('/', create);
router.post('/assign', assignNumber);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', deleteOne);

export default router;