const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return sendUtf8(
        res,
        'id_list_message=t-שגיאה: חסר פרמטר url,&'
      );
    }

    const finalUrl = new URL(targetUrl);

    // מעביר ל-Google Apps Script את כל הפרמטרים מלבד url
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'url') {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          finalUrl.searchParams.append(key, String(item));
        }
      } else if (value !== undefined) {
        finalUrl.searchParams.append(key, String(value));
      }
    }

    const response = await axios.get(finalUrl.toString(), {
      maxRedirects: 10,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        Accept: 'text/plain; charset=utf-8'
      }
    });

    // פענוח מפורש של התשובה כטקסט UTF-8
    const responseText = Buffer.from(response.data).toString('utf8');

    return sendUtf8(res, responseText);

  } catch (err) {
    const errorMessage =
      err.response?.status
        ? `שגיאה בקבלת הנתונים. קוד שגיאה ${err.response.status}`
        : err.message;

    return sendUtf8(
      res,
      `id_list_message=t-שגיאת שרת פרוקסי: ${errorMessage},&`
    );
  }
});

function sendUtf8(res, text) {
  const utf8Buffer = Buffer.from(String(text), 'utf8');

  res.status(200);
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': utf8Buffer.length,
    'Cache-Control': 'no-store'
  });

  return res.end(utf8Buffer);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dynamic Proxy server running on port ${PORT}`);
});
