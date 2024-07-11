import { Router } from 'express';

const router = Router();
const Controller = require('../controller/calltracking.controller');
const { getSubaccounts,getTotalCallHistory, delSubAccount, update, getProfile, getCallHistory, getRecordingsForCall, getTotalCallCounts, getFirstTimeCallersCount, assignBackPhoneNumber, assignPhoneNumber, getNumberpool } = Controller;

router.get('/', getSubaccounts);
router.get('/history', getTotalCallHistory);
router.post('/getRecordingsForCall', getRecordingsForCall);
router.post('/assign-phone', assignPhoneNumber);
router.post('/assignback-phone', assignBackPhoneNumber);
router.post('/pool', getNumberpool);
router.get('/profile', getProfile);
router.get('/total', getTotalCallCounts);
router.get('/first', getFirstTimeCallersCount);
router.get('/:sid', getCallHistory);
router.put('/:sid', update);
router.delete('/:sid', delSubAccount);
export default router;