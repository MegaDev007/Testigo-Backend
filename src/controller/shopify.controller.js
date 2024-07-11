const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
import nodemailer from 'nodemailer';
import { fetchProducts, fetchOrders } from '../service/shopify.service';

// Get getProductData from api
export const getProductData = async (req, res) => {
  const { shopName, accessToken } = req.body;
  if (!shopName || !accessToken) {
    return res.status(400).json({ error: 'Missing shopName or accessToken' });
  }

  try {
    const products = await fetchProducts(shopName, accessToken);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching products' });
  }
}

