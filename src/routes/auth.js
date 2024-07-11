import { Router } from 'express';

const router = Router();
const Controller = require('../controller/auth.controller');
const { signIn, signUp, signOut } = Controller;

router.post('/signin', signIn);
router.post('/signup', signUp);
router.post('/signout', signOut);

export default router;