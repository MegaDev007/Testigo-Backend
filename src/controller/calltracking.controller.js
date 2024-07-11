const twilio = require('twilio');
const moment = require('moment');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
export const getSubaccounts = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'asc', orderBy = 'friendlyName', search = '', allFlag, status } = req.query;
    let listStatus = {};
    if (status)
      listStatus = { "status": status };
    const subaccounts = await client.api.accounts.list(listStatus).catch(err => console.log('hello', err));
    const total = subaccounts.length;
    if (allFlag) {
      res.status(200).json({
        data: subaccounts,
        total
      });
    } else {
      let filteredSubaccounts = subaccounts.filter(subaccount =>
        subaccount.friendlyName.toLowerCase().includes(search.toLowerCase()) ||
        subaccount.sid.toLowerCase().includes(search.toLowerCase())
      );
      filteredSubaccounts.sort((a, b) => {
        if (sort === 'asc') {
          return a[orderBy] > b[orderBy] ? 1 : -1;
        } else {
          return a[orderBy] < b[orderBy] ? 1 : -1;
        }
      });
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedSubaccounts = filteredSubaccounts.slice(startIndex, endIndex);
      res.status(200).json({
        data: paginatedSubaccounts,
        count: filteredSubaccounts.length,
        total
      });
    }
  } catch (error) {
    console.error('Error fetching subaccounts:', error);
    res.status(500).json({ error: 'Failed to fetch subaccounts' });
  }
}

export const getProfile = async (req, res) => {
  const { sid } = req.query;

  if (!sid) {
    return res.status(400).json({ error: 'Subaccount SID is required' });
  }

  try {
    const subaccount = await client.api.accounts(sid).fetch();
    const phoneNumbers = await client.api.accounts(sid).incomingPhoneNumbers.list();
    const response = {
      sid: subaccount.sid,
      friendlyName: subaccount.friendlyName,
      status: subaccount.status,
      dateCreated: subaccount.dateCreated,
      dateUpdated: subaccount.dateUpdated,
      phoneNumbers: phoneNumbers.map(phoneNumber => ({
        sid: phoneNumber.sid,
        phoneNumber: phoneNumber.phoneNumber,
        friendlyName: phoneNumber.friendlyName,
        dateCreated: phoneNumber.dateCreated,
        dateUpdated: phoneNumber.dateUpdated
      }))
    };
    res.status(200).json(response);
  } catch (error) {
    console.error(`Failed to get subaccount ${sid}: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch subaccount details' });
  }
};

export const delSubAccount = async (req, res) => {
  const { sid } = req.params;
  if (!sid) {
    return res.status(400).json({ error: 'Missing required parameters: sid ' });
  }
  client.api.accounts(sid)
    .update({ status: 'closed' })
    .then(() => {
      res.status(204).send();
    })
    .catch(error => {
      console.error(`Failed to delete subaccount ${sid}: ${error.message}`);
    });
}

export const update = async (req, res) => {
  const { sid } = req.params;
  const { body } = req;
  try {
    if (!body.friendlyName)
      return res.status(400).json({ error: 'Missing required parameters: friendlyName ' });
    let subaccount = await client.api.accounts(sid).fetch();
    if (body.friendlyName != subaccount.friendlyName) {
      subaccount = await subaccount.update({ friendlyName: body.friendlyName });
    }
    res.status(200).json({ friendlyName: subaccount.friendlyName, sid: sid });
  } catch (error) {
    res.status(500).json({ error });
  }
}

export const getRecordingsForCall = async (req, res) => {
  const { accountsid, callSid, authToken } = req.body;
  try {
    // const subaccountClient = twilio(accountsid, authToken);
    const recordings = await client.api.accounts(accountsid).recordings.list({ callSid });
    const recordingData = recordings.map((recording) => ({
      sid: recording.sid,
      url: recording.uri,
    }));
    res.status(200).json({
      data: recordingData
    });
  } catch (error) {
    res.status(500).json({ error: error });
  }
}

export const getTotalCallHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;
    const subAccounts = await client.api.accounts.list({ status: 'active' }).catch(err => console.log('hello', err));
    const callLogPromises = subAccounts.map(subAccount => fetchCallLogs(subAccount.sid, subAccount.authToken, pageSize));
    const callLogsResults = await Promise.all(callLogPromises);
    const totalCallHistory = callLogsResults.flat();
    totalCallHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    const filterData = totalCallHistory.filter(item => item.direction !== 'outbound-dial');
    const paginatedCallHistory = filterData.slice(offset, offset + pageSize);
    res.json({
      page: page,
      pageSize: pageSize,
      callLogs: paginatedCallHistory
    });
  } catch (error) {
    res.status(500).send('Error fetching call history');
  }
};

const fetchCallLogs = async (subAccountSid, token, pageSize) => {
  try {
    const subClient = twilio(subAccountSid, token);
    const calls = await subClient.calls.list({
      limit: pageSize
    });
    return calls;
  } catch (error) {
    console.error(`Error fetching call logs for subaccount ${subAccountSid}:`, error);
    return [];
  }
};

export const getCallHistory = async (req, res) => {
  const { sid } = req.params;
  const { token, pageSize, page } = req.query;

  if (!sid || !token) {
    return res.status(400).json({ error: 'Missing required parameters: sid and token' });
  }

  try {
    const client = twilio(sid, token);
    await client.calls.page({
      pageSize: parseInt(pageSize, 10),
      pageNumber: parseInt(page, 10)
    }, async (err, items) => {
      res.status(200).json({
        data: items.instances
      });
    });
  } catch (error) {
    console.error('Error fetching call history for account SID', sid, ':', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
};

export const getTotalCallCounts = async (req, res) => {
  try {
    const { sid, startDate, endDate } = req.query;

    if (!moment(startDate, 'YYYY-MM-DD', true).isValid() || !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const startDateTime = moment(startDate).toISOString();
    const endDateTime = moment(endDate).toISOString();

    if (sid) {
      const calls = await client.calls.list({
        startTimeAfter: startDateTime,
        startTimeBefore: endDateTime,
        subaccountSid: sid
      });

      const detail = {
        friendlyName: '',
        sid: sid,
        count: calls.length,
      };

      return res.status(200).json({ total: calls.length, detail: [detail] });
    } else {
      const subaccounts = await client.api.accounts.list({ status: 'active' });

      const callCountPromises = subaccounts.map(async (subaccount) => {
        const subaccountSid = subaccount.sid;
        const friendlyName = subaccount.friendlyName;
        const token = subaccount.authToken;
        const tempClient = twilio(subaccountSid, token);

        const calls = await tempClient.calls.list({
          startTimeAfter: startDateTime,
          startTimeBefore: endDateTime
        });

        const inboundCalls = calls.filter(item => item.direction === "inbound");
        const missedCalls = calls.filter(item => item.status !== "completed" || parseInt(item.duration) === 0);
        const completedCalls = calls.filter(item => item.status === "completed");
        const totalDuration = completedCalls.reduce((total, call) => total + parseInt(call.duration, 10), 0);
        const averageDuration = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0;
        return {
          friendlyName: friendlyName,
          sid: subaccountSid,
          count: inboundCalls.length,
          miss: missedCalls.length,
          average: averageDuration
        };
      });

      const details = await Promise.all(callCountPromises);
      const totalCallCount = details.reduce((total, detail) => total + detail.count, 0);
      const missedCallCount = details.reduce((total, detail) => total + detail.miss, 0);
      const temp = details.filter((item) => item.average > 0);
      const averageDuration = details.reduce((total, detail) => total + detail.average, 0) / temp.length;
      return res.status(200).json({ total: totalCallCount, miss: missedCallCount, averageDuration, detail: details });
    }
  } catch (error) {
    console.error('Error fetching call counts:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const cache = new Map();
export const getFirstTimeCallersCount = async (req, res) => {
  try {
    const { sid, startDate, endDate } = req.query;

    // Validate date format
    if (!moment(startDate, 'YYYY-MM-DD', true).isValid() || !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const isFirstTimeCaller = async (phoneNumber, client) => {
      if (cache.has(phoneNumber)) {
        return cache.get(phoneNumber);
      }
      try {
        const previousCalls = await client.calls.list({
          from: phoneNumber,
          startTimeBefore: startDate,
          limit: 1,
        });
        const isFirstTimer = previousCalls.length === 0;
        cache.set(phoneNumber, isFirstTimer);
        return isFirstTimer;
      } catch (error) {
        console.error(`Error checking first-time caller for ${phoneNumber}`, error);
        return false;
      }
    };

    const getFirstTimeCallers = async (client) => {
      const calls = await client.calls.list({
        startTimeAfter: startDate,
        startTimeBefore: endDate,
      });

      const phoneNumbers = [...new Set(calls.map(call => call.from))];
      const firstTimeCallerPromises = phoneNumbers.map(async (phoneNumber) => {
        const isFirstTimer = await isFirstTimeCaller(phoneNumber, client);
        return isFirstTimer ? 1 : 0;
      });

      const firstTimeCallerResults = await Promise.all(firstTimeCallerPromises);
      return firstTimeCallerResults.reduce((total, isFirstTimer) => total + isFirstTimer, 0);
    };

    const getDetailedFirstTimeCallers = async (client, subaccount) => {
      const firstTimeCallersCount = await getFirstTimeCallers(client);
      return {
        friendlyName: subaccount.friendlyName,
        sid: subaccount.sid,
        count: firstTimeCallersCount,
      };
    };

    if (sid) {
      const firstTimeCallersCount = await getFirstTimeCallers(client);
      const detail = {
        friendlyName: '',
        sid: sid,
        count: firstTimeCallersCount,
      };
      return res.status(200).json({ total: firstTimeCallersCount, detail: [detail] });
    } else {
      const subaccounts = await client.api.accounts.list({ status: 'active' });
      const firstTimeCallersPromises = subaccounts.map(async (subaccount) => {
        const subaccountSid = subaccount.sid;
        const token = subaccount.authToken;
        const tempClient = twilio(subaccountSid, token);
        return await getDetailedFirstTimeCallers(tempClient, subaccount);
      });
      const details = await Promise.all(firstTimeCallersPromises);
      const totalFirstTimeCallersCount = details.reduce((total, detail) => total + detail.count, 0);
      return res.status(200).json({ total: totalFirstTimeCallersCount, detail: details });
    }
  } catch (error) {
    console.error('Error fetching first-time callers count:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const assignPhoneNumber = async (req, res) => {
  try {
    const { phoneSid, accountSid } = req.body;
    console.log(req.body);
    try {
      const phoneNumber = await client.incomingPhoneNumbers(phoneSid).update({
        accountSid: accountSid
      });
      res.status(200).json({ success: true, phoneNumber });
    } catch (error) {
      res.status(500).send(error.message);
    }
  } catch (error) {
    return error.message;
  }
}

export const assignBackPhoneNumber = async (req, res) => {
  try {
    const { phoneSid, accountSid } = req.body;
    try {
      const phoneNumber = await client.api.accounts(accountSid).incomingPhoneNumbers(phoneSid).update({
        accountSid: process.env.TWILIO_ACCOUNT_SID
      });
      res.status(200).json({ success: true, phoneNumber });
    } catch (error) {
      res.status(500).send(error.message);
    }
  } catch (error) {
    return error.message;
  }
}

export const getNumberpool = async (req, res) => {
  try {
    const { subaccountSid } = req.body;
    const subaccountClient = twilio(subaccountSid, process.env.TWILIO_AUTH_TOKEN);
    const phoneNumbers = await subaccountClient.incomingPhoneNumbers.list();
    const numberDetails = phoneNumbers.map(number => ({
      number: number.phoneNumber,
      forwardingNumber: number.voiceUrl,  // Assuming forwarding number is stored in voiceUrl
      status: number.status,
    }));

    res.status(200).json(numberDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
