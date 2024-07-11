const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
import { fetchProducts, fetchOrders } from '../service/shopify.service';

// Get getProductData from api
export const getProductData = async (req, res) => {
  const { shopName, accessToken } = req.body;
  if (!shopName || !accessToken) {
    return res.status(400).json({ error: 'Missing shopName or accessToken' });
  }
  //Values for x-axis
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  };
  
  const generateDateArray = () => {
    const dateArray = [];
    const currentDate = new Date();
    
    // Start from 36 months ago
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 35);
    
    while (startDate <= currentDate) {
      dateArray.push(formatDate(startDate));
      startDate.setMonth(startDate.getMonth() + 1);
    }
    
    return dateArray;
  };
  
  const dates = generateDateArray();
  console.log(dates);

  try {
    //Values for y-axis
    const products = await fetchProducts(shopName, accessToken);
    const monthsDifference = (date1, date2) => {
      const year1 = date1.getFullYear();
      const year2 = date2.getFullYear();
      const month1 = date1.getMonth();
      const month2 = date2.getMonth();
  
      return (year2 - year1) * 12 + (month2 - month1);
  };
  
  // Initialize the array of length 36 with zeros
  const resultArray = new Array(36).fill(0);
  
  // Current date for comparison
  const currentDate = new Date();
  
  products.forEach(item => {
      const createdAt = new Date(item.created_at);
      const monthsDiff = monthsDifference(createdAt, currentDate);
      const position = 36 - monthsDiff - 1; // Calculate the position in the array
      
      if (position >= 0 && position < 36) {
          resultArray[position]++;
      }
  });
  
  console.log(resultArray);

  const jsonResponse = {
    date: dates,
    count: resultArray
  };
  res.json(jsonResponse);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching products' });
  }

 
}

