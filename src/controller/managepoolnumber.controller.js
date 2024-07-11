import { PrismaClient } from '@prisma/client';
import { subDays, subMinutes, subSeconds } from 'date-fns';

const twilio = require('twilio');

const prisma = new PrismaClient();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const getList = async (req, res) => {
  const { search, sort, order = 'asc', page = 1, pageSize = 50 } = req.query;
  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { forwarding_number: { contains: search, mode: 'insensitive' } },
      { swap_target: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy = {};
  if (sort) {
    orderBy[sort] = order;
  }

  const skip = (parseInt(page) - 1) * parseInt(pageSize);
  const take = parseInt(pageSize);

  try {
    const numberPools = await prisma.numberPools.findMany({
      where,
      orderBy: sort ? [orderBy] : undefined,
      skip,
      take,
      include: {
        numbers: true,
        visitors: true,
      },
    });
    const totalCount = await prisma.numberPools.count({ where });

    res.status(200).json({
      data: numberPools,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getOne = async (req, res) => {
  const { id } = req.params;

  try {
    const numberPool = await prisma.numberPools.findUnique({
      where: { id: parseInt(id) },
      include: {
        numbers: true,
        visitors: true,
      },
    });

    if (!numberPool) {
      return res.status(404).json({ error: 'Number pool not found' });
    }

    res.status(200).json(numberPool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req, res) => {
  const { frindlyName, forwardingNumber, swapTarget = "", timeout = 30, phoneNumbers } = req.body;
  const poolSize = phoneNumbers.length;
  const encodedForwardingNumber = encodeURIComponent(forwardingNumber);
  const voiceUrl = `${process.env.HOST}/api/twilio/forward-call?forwardingNumber=${encodedForwardingNumber}`;
  try {
    phoneNumbers.map(async item => {
      await client.incomingPhoneNumbers.create({ phoneNumber: item.phoneNumber, voiceUrl });
    });
    const numberPool = await prisma.numberPools.create({
      data: {
        frindlyName,
        forwardingNumber,
        poolSize,
        swapTarget,
        timeout,
        numbers: {
          create: phoneNumbers.map((item) => ({
            phoneNumber: item.phoneNumber,
            frindlyName: item.friendlyName,
          })),
        },
      },
    });
    const poolId = numberPool.id;
    const baseUrl = process.env.HOST || 'https://your-server-url';
    const scriptUrls = {
      numberPoolScript: `${baseUrl}/api/pool/appengine/${poolId}/number_pool.js`,
    };
    res.status(200).json({ numberPool, scriptUrls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const update = async (req, res) => {
  const { id } = req.params;
  const { name, forwardingNumber, swapTarget, timeout } = req.body;

  try {
    const numberPool = await prisma.numberPools.update({
      where: { id: parseInt(id) },
      data: {
        name,
        forwardingNumber,
        swapTarget,
        timeout,
      },
    });

    res.status(200).json(numberPool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteOne = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.numberPools.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).json();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignNumber = async (req, res) => {
  const { cookie, poolId, source, medium } = req.body;
  const dateThreshold = subMinutes(new Date(), 5);
  try {
    let visitor;
    if (cookie) {
      visitor = await prisma.visitors.findUnique({
        where: { cookie: cookie },
      });
    }

    if (visitor) {
      res.status(200).json({ phoneNumber: visitor.phoneNumber });
    } else {
      const availableNumber = await prisma.numbers.findFirst({
        where: {
          poolId: parseInt(poolId, 10),
          OR: [
            { assigned: false },
            {
              assigned: true,
              lastAssignedAt: {
                lte: dateThreshold
              },
            },
          ],
        },
      });

      if (!availableNumber) {
        return res.status(404).json({ error: 'No available phone numbers in the pool' });
      }

      await prisma.numbers.update({
        where: { id: availableNumber.id },
        data: { assigned: true, lastAssignedAt: new Date() },
      });

      const cookieValue = availableNumber.phoneNumber;
      visitor = await prisma.visitors.create({
        data: {
          poolId: parseInt(poolId, 10),
          cookie: cookieValue,
          phoneNumber: availableNumber.phoneNumber,
          source,
          medium,
        },
      });
      res.status(200).json({ phoneNumber: visitor.phoneNumber });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

export const serveNumberPoolScript = async (req, res) => {
  const { poolId } = req.params;

  try {
    const numberPool = await prisma.numberPools.findUnique({
      where: { id: parseInt(poolId) },
      include: { numbers: true },
    });

    if (!numberPool) {
      return res.status(404).send('Number pool not found');
    }

    const scriptContent = `
      (function() {
        const scriptURL = '${process.env.HOST || 'http://localhost:3000'}/api/pool/assign';

        function getLocalStorageItem(name) {
          return localStorage.getItem(name);
        }

        function setLocalStorageItem(name, value) {
          localStorage.setItem(name, value);
        }

        function swapNumber(number) {
          const elements = document.querySelectorAll('.tracking-number');
          elements.forEach(element => {
            element.textContent = number;
          });
        }

        const storageKey = 'phone';
        let phoneNumber = getLocalStorageItem(storageKey);

        if (!phoneNumber) {
          fetch(scriptURL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cookie: getLocalStorageItem('user_cookie'),
              poolId: '${poolId}',
              source: 'web',
              medium: 'organic',
            }),
          })
            .then(response => response.json())
            .then(data => {
              if (data.phoneNumber) {
                phoneNumber = data.phoneNumber;
                setLocalStorageItem(storageKey, phoneNumber);
                swapNumber(phoneNumber);
              }
            })
            .catch(error => console.error('Error:', error));
        } else {
          swapNumber(phoneNumber);
        }
      })();
    `;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(scriptContent);
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
};

