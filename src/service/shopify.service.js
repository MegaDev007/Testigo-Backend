import axios from 'axios';

// Function to fetch products from Shopify
export const fetchProducts = async (shopName, accessToken) => {
  const shopifyBaseUrl = `https://${shopName}.myshopify.com/admin/api/2023-01`;

  try {
    const response = await axios.get(`${shopifyBaseUrl}/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });
    return response.data.products;
  } catch (err) {
    console.error('Error fetching products:', err);
    throw err;
  }
};

// Function to fetch orders from Shopify
export const fetchOrders = async (shopName, accessToken) => {
  const shopifyBaseUrl = `https://${shopName}.myshopify.com/admin/api/2023-01`;

  try {
    const response = await axios.get(`${shopifyBaseUrl}/orders.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });
    return response.data.orders;
  } catch (err) {
    console.error('Error fetching orders:', err);
    throw err;
  }
};
