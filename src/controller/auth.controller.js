const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET; // You should store your secret in an environment variable


const COOKIE_EXPIRES_IN = 60 * 60; // 1 hour in seconds

const generateToken = (userEmail) => {
  return jwt.sign({ userEmail }, JWT_SECRET, { expiresIn: '1h' });
};

const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + COOKIE_EXPIRES_IN * 1000), // convert to milliseconds
  };
  res.cookie('jwt', token, cookieOptions);
};

export const signUp = async (req, res) => {
  try {
    const { email, username, password, company } = req.body;
    let user = await prisma.users.findUnique({ where: { email } });
    if (user) {
      return res.status(400).send('User already exists with the given email.');
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = await prisma.users.create({
      data: {
        email,
        name: username,
        password: hashedPassword,
        company
      },
    });
    console.log("email",email);

    const token = generateToken(user.email);
    setTokenCookie(res, token);

    res.status(201).json({ message: 'User created successfully!', name: user.name, email: user.email });
  } catch (error) {
    res.status(500).send(error);
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).send('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send('Invalid credentials.');
    }

    const token = generateToken(user.email);
    setTokenCookie(res, token);

    res.status(200).json({ message: 'Logged in successfully!', name: user.name, email: user.email });
  } catch (error) {
    res.status(500).send(error);
  }
};

export const signOut = async (req, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Ensure the cookie is only sent over HTTPS in production
      sameSite: 'strict', // Restrict the cookie to same-site requests
    });

    res.status(200).json({ message: 'Logged out successfully!' });
  } catch (error) {
    res.status(500).send('Error signing out.');
  }
};
