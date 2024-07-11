const twilio = require('twilio');
const qs = require('qs');
const { reportToGoogleAds, reportToMicrosoftAds } = require('../utils/utils');

import { PrismaClient } from '@prisma/client';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const prisma = new PrismaClient();
export const search = async (req, res) => {
  try {
    const { countryCode, params } = req.body;
    const numbers = await client.availablePhoneNumbers(countryCode).local.list({
      ...params
    });
    res.status(200).json({ success: true, numbers: numbers });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching search');
  }
};

export const forwardCall = async (req, res) => {
  const { forwardingNumber } = req.query;
  const { To, CallSid } = req.body;

  try {
    const number = await prisma.numbers.findFirst({ where: { phoneNumber: To } });
    const isConversion = number && number.poolId;
    if (isConversion) {
      await reportToGoogleAds(CallSid);
      await reportToMicrosoftAds(CallSid);
    }
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial(forwardingNumber);
    res.type('text/xml');                                           
    res.send(twiml.toString());                              
  } catch (error) {
    console.error('Error forwarding call:', error);
    res.status(500).send('Internal Server Error');                    
  }
};
                         
export const purchase = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber
    });

    res.status(200).json({ success: true, phoneNumber: purchasedNumber.phoneNumber, sid: purchasedNumber.sid });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching recommended purchase');
  }
};

// controller to search for price of phone numbers
export const price = async (req, res) => {
  try {
    const { countryCode } = req.body;
    const pricing = await client.pricing.v1.phoneNumbers.countries(countryCode).fetch();
    res.status(200).json({ success: true, pricing: pricing });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching search');
  }
};

// controller to search for price of phone numbers
export const getPhoneNumbers = async (req, res) => {
  try {
    const numbers = await client.incomingPhoneNumbers.list();
    const formattedNumbers = numbers.map(phoneNumber => {
      const temp = phoneNumber.voiceUrl ? qs.parse(phoneNumber.voiceUrl.split('?')[1]) : null;
      return {
        id: phoneNumber.sid,
        friendlyName: phoneNumber.friendlyName,
        number: phoneNumber.phoneNumber,
        purchasedDate: phoneNumber.dateUpdated,
        country: phoneNumber.countryCode,
        forwardingNumber: temp ? temp.forwardingNumber : null,
        type: "",
        callTimeout: phoneNumber.voiceCallerIdLookup,
      }
    });

    res.status(200).json({ success: true, numbers: formattedNumbers });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching search');
  }
};

// controller to delete for price of phone numbers
export const deletePhoneNumbers = async (req, res) => {
  const { phoneNumberSid } = req.body;
  if (!phoneNumberSid) {
    return res.status(400).json({ success: false, message: 'Phone number SID is required.' });
  }
  try {
    await client.incomingPhoneNumbers(phoneNumberSid).remove();
    res.status(200).json({ success: true, message: 'Phone number deleted successfully.' });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error fetching search');
  }
};

// controller to set purchased phone numbers
export const setPhoneNumbers = async (req, res) => {
  const { phoneNumberSid, forwardingNumber, friendlyname } = req.body;

  try {
    if (!phoneNumberSid) {
      return res.status(400).json({ success: false, message: 'Purchased Number does not exist.' });
    }
    if (friendlyname) {
      await client.incomingPhoneNumbers(phoneNumberSid).update({ friendlyName: friendlyname });
    }
    if (forwardingNumber) {
      const encodedForwardingNumber = encodeURIComponent(forwardingNumber);
      const voiceUrl = `${process.env.HOST}/api/twilio/forward-call?forwardingNumber=${encodedForwardingNumber}`;
      await client.incomingPhoneNumbers(phoneNumberSid).update({ voiceUrl });
    }
    res.status(200).json({ success: true, message: 'Success' });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: 'An error occurred while updating the phone number.', error: error.message });
  }
}

export const getTypeNumbers = async (req, res) => {
  const { phoneNumber } = req.body;
  try {
    const lookup = await client.lookups.v1.phoneNumbers(phoneNumber).fetch({ type: ['carrier'] });
    let type = "";
    if (lookup.carrier.name.includes("Mobile"))
      type = "Mobile";
    else
      if (lookup.carrier.name.includes("Toll-Free"))
        type = "Toll-Free";
      else
        type = "Local";
    res.json({ phoneNumber, type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const setFriendlyName = async (phoneNumberSid, newFriendlyName) => {
  try {
    const phoneNumber = await client.incomingPhoneNumbers(phoneNumberSid)
      .update({ friendlyName: newFriendlyName });
    return phoneNumber;
  } catch (error) {
    return error.message;
  }
}

