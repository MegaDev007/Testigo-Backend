const { google } = require('googleapis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Google Ads Conversion Reporting
export const reportToGoogleAds = async (callSid) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'path_to_your_service_account_key.json', //necessary info
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  const request = {
    customerId: 'your_google_ads_customer_id', //necessary info
    requestBody: {
      conversions: [
        {
          conversionAction: 'customers/1234567890/conversionActions/0987654321', //necessary info
          conversionDateTime: new Date().toISOString(),
          conversionValue: 1.0,
          orderId: callSid,
        },
      ],
    },
  };

  const response = await google.ads('v9').customers.conversions.upload(request);

  if (response.errors) {
    console.error('Error reporting conversion to Google Ads:', response.errors);
  } else {
    console.log('Conversion reported to Google Ads:', response.data);
    await prisma.conversion.create({
      data: {
        callSid,
        conversionAction: 'Phone Call Conversion',
        conversionDateTime: new Date().toISOString(),
        conversionValue: 1.0,
      },
    });
  }
};

export const reportToMicrosoftAds = async (callSid) => {
  const tokenResponse = await axios.post('https://login.microsoftonline.com/your_tenant_id/oauth2/v2.0/token', {
    grant_type: 'client_credentials',
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    scope: 'https://ads.microsoft.com/.default',
  });

  const accessToken = tokenResponse.data.access_token;  //necessary info

  const conversionData = {
    Conversions: [
      {
        ConversionCurrencyCode: 'USD',
        ConversionName: 'Phone Call Conversion', //necessary info
        ConversionTime: new Date().toISOString(),
        ConversionValue: 1.0,
        MicrosoftClickId: callSid,
      },
    ],
  };

  const response = await axios.post('https://api.ads.microsoft.com/v11/CustomerAccountId/OfflineConversions', conversionData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.errors) {
    console.error('Error reporting conversion to Microsoft Ads:', response.errors);
  } else {
    console.log('Conversion reported to Microsoft Ads:', response.data);
    await prisma.conversion.create({
      data: {
        callSid,
        conversionAction: 'Phone Call Conversion',
        conversionDateTime: new Date().toISOString(),
        conversionValue: 1.0,
      },
    });
  }
};