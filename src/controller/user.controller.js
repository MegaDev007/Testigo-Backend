const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');
const prisma = new PrismaClient();
import nodemailer from 'nodemailer';
const mailgun = require('mailgun-js')
    ({ apiKey: process.env.EMAIL_API_KEY, domain: process.env.EMAIL_DOMAIN });

// Initialize the Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const JWT_SECRET = process.env.JWT_SECRET; // You should store your secret in an environment variable
// Get list of all users
export const getList = async (req, res) => {
  const { search, sort, order = 'asc', page = 1, pageSize = 50, type, sid } = req.query;
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { streetAddress: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
      { businessEmail: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (type) {
    where.type = parseInt(type);
  }
  const orderBy = {};
  if (sort) {
    orderBy[sort] = order;
  }
  if (sid) {
    where.sid = sid;
  }
  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const take = parseInt(pageSize);

  try {
    const users = await prisma.users.findMany({
      where,
      orderBy: sort ? [orderBy] : undefined,
      skip,
      take,
    });
    const totalCount = await prisma.users.count({ where });
    res.status(200).json({
      data: users,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Get a single user by ID/
export const getOne = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) }
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

// Create a new user
export const create = async (req, res) => {
  const { body } = req;
  let sid = "";

  // Create subaccount in Twilio if friendlyBusinessName is provided
  if (body.friendlyBusinessName) {
    try {
      const subaccount = await client.api.accounts.create({ friendlyName: body.friendlyBusinessName });
      if (!subaccount) {
        return res.status(400).send('Cannot create a subaccount in Twilio.');
      }
      sid = subaccount.sid;
    } catch (error) {
      return res.status(400).send('Error creating subaccount in Twilio.');
    }
  }

  try {
    // Hash the user's password
    const hashedPassword = bcrypt.hashSync(body.password, 10);

    // Create the new user in the database
    const newUser = await prisma.users.create({
      data: { ...body, sid: sid, password: hashedPassword }
    });

    // const transporter = nodemailer.createTransport({
    //   host: 'smtp.mailgun.org', // Mailgun SMTP host
    //   port: 587, // Mailgun SMTP port
    //   auth: {
    //     user: process.env.EMAIL,
    //     pass: process.env.PASS
    //   }
    // });

    const data = {
      "from": process.env.EMAIL,
      "to": newUser.email,
      "subject": 'Welcome to Our Service',
      "text": `Hello ${newUser.name},\n\nThank you for registering with us!`
    };

    // const mailOptions = {
    //   from: process.env.EMAIL,
    //   to: newUser.email,
    //   subject: 'Welcome to Our Service',
    //   text: `Hello ${newUser.name},\n\nThank you for registering with us!`
    // };
    
    console.log("mailgun,",mailgun, data)
    mailgun.messages().send(data, (error, body) => {
      if (error) console.log('Error sending email:', error)
      else console.log('Email sent:', body);
    });

    // transporter.sendMail(mailOptions, (error, info) => {
    //   if (error) {
    //     console.log('Error sending email:', error);
    //   } else {
    //     console.log('Email sent:', info.response);
    //   }
    // });

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error });
  }
}

// Update an existing user by ID
export const update = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  try {
    let sid = "";
    if (body.sid) {
      sid = body.sid;
      let subaccount = await client.api.accounts(body.sid);
      if(subaccount.friendlyName != body.friendlyBusinessName && body.friendlyBusinessName)
      subaccount = subaccount.update({ friendlyName: body.friendlyBusinessName });
      else
      if(!body.friendlyBusinessName)
        return res.status(400).send('Need Friendly Business Name');
      if (!subaccount) {
        return res.status(400).send('Cannot update a subaccount in twilio.');
      }
    }
    else
    {
      if (body.friendlyBusinessName) {
        const subaccount = await client.api.accounts.create({ friendlyName: body.friendlyBusinessName });
        if (!subaccount) {
          return res.status(400).send('Cannot create a subaccount in twilio.');
        }
        else sid = subaccount.sid;
      }
    }
    const payload = body.password ? { ...body, sid: sid, password: bcrypt.hashSync(body.password, 10) } : body;

    const updatedUser = await prisma.users.update({
      where: { id: parseInt(id) },
      data: payload
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error });
  }
}

// Delete a user by ID
export const deleteOne = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) }
    });
    if (user.sid) {
      const res_del = await client.api.accounts(user.sid).update({status: 'closed'})
    }
    const result = await prisma.users.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

//Get profile
export const getProfile = async (req, res) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ message: 'Authentication token is missing' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userEmail = decoded.userEmail;
    const user = await prisma.users.findUnique({
      where: { email: userEmail },
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ message: 'User found', profile: user });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}