const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  try {
    /*
     * קריאת הכתובת המקורית במקום req.query.
     * כך נשמרת העברית כפי שהגיעה לשרת.
     */
    const incomingUrl = new URL(
      req.originalUrl,
      `http://${req.headers.host || 'localhost'}`
    );

    const targetUrl = incomingUrl.searchParams.get('url');

    if (!targetUrl) {
      return sendUtf8(
        res,
        'id_list_message=t-שגיאה: חסר פרמטר url,&'
      );
    }

    const finalUrl = new URL(targetUrl);

    /*
     * העברת כל הפרמטרים לסקריפט.
     * URLSearchParams מקודד את העברית אוטומטית רק בשלב השליחה.
     */
    for (const [key, value] of incomingUrl.searchParams.entries()) {
      if (key !== 'url') {
        finalUrl.searchParams.append(key, value);
      }
    }

    console.log('Original URL:', req.originalUrl);
    console.log('Final URL:', finalUrl.toString());

    const response = await axios.get(finalUrl.toString(), {
      maxRedirects: 10,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        Accept: 'text/plain; charset=utf-8'
      }
    });

    const responseText = Buffer
      .from(response.data)
      .toString('utf8');

    return sendUtf8(res, responseText);

  } catch (err) {
    console.error(err);

    const errorMessage = err.response?.status
      ? `שגיאה בקבלת הנתונים. קוד שגיאה ${err.response.status}`
      : err.message;

    return sendUtf8(
      res,
      `id_list_message=t-שגיאת שרת פרוקסי: ${errorMessage},&`
    );
  }
});

function sendUtf8(res, text) {
  const data = Buffer.from(String(text), 'utf8');

  res.status(200);
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store'
  });

  return res.end(data);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dynamic Proxy server running on port ${PORT}`);
});
