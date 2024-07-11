import { Router } from 'express';

const router = Router();
const Controller = require('../controller/twilio.controller');
const { search, purchase, price, getPhoneNumbers, deletePhoneNumbers, setPhoneNumbers, getTypeNumbers, forwardCall } = Controller;

router.post('/search', search);
router.post('/purchase', purchase);
router.post('/price', price);
router.post('/forward-call', forwardCall);
router.get('/getPhone-numbers', getPhoneNumbers);
router.post('/setPhone-numbers', setPhoneNumbers);
router.post('/deletePhone', deletePhoneNumbers);
router.get('/getTypePhone', getTypeNumbers);

export default router;
