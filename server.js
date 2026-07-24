const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * החזרת תשובת טקסט בקידוד UTF-8.
 */
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

/**
 * תיקון כתובת הכוללת עברית גולמית.
 *
 * Node.js עשוי לקרוא תווים עבריים בכתובת כאילו הם Latin-1,
 * אף שהם נשלחו בפועל כ-UTF-8.
 */
function repairRawUrlEncoding(originalUrl) {
  try {
    return Buffer
      .from(originalUrl, 'latin1')
      .toString('utf8');
  } catch (error) {
    return originalUrl;
  }
}

/**
 * נתיב ראשי:
 *
 * url = כתובת Google Apps Script.
 * כל יתר הפרמטרים מועברים אל Google Apps Script.
 */
app.get('/', async (req, res) => {
  try {
    const correctedOriginalUrl = repairRawUrlEncoding(
      req.originalUrl
    );

    console.log('Original URL:', req.originalUrl);
    console.log('Corrected URL:', correctedOriginalUrl);

    const incomingUrl = new URL(
      correctedOriginalUrl,
      `http://${req.headers.host || 'localhost'}`
    );

    const targetUrl = incomingUrl.searchParams.get('url');

    if (!targetUrl) {
      return sendUtf8(
        res,
        'id_list_message=t-שגיאה: חסר פרמטר url,&'
      );
    }

    let finalUrl;

    try {
      finalUrl = new URL(targetUrl);
    } catch (error) {
      return sendUtf8(
        res,
        'id_list_message=t-שגיאה: כתובת היעד אינה תקינה,&'
      );
    }

    /*
     * העברת כל הפרמטרים ל-Google Apps Script,
     * מלבד הפרמטר url עצמו.
     *
     * append מאפשר גם מספר מופעים של אותו פרמטר.
     */
    for (const [key, value] of incomingUrl.searchParams.entries()) {
      if (key !== 'url') {
        finalUrl.searchParams.append(key, value);
      }
    }

    console.log('Final URL:', finalUrl.toString());

    const response = await axios.get(finalUrl.toString(), {
      maxRedirects: 10,
      responseType: 'arraybuffer',
      timeout: 30000,
      validateStatus: () => true,
      headers: {
        Accept: 'text/plain; charset=utf-8',
        'User-Agent': 'Render-Dynamic-Proxy/1.0'
      }
    });

    const responseText = Buffer
      .from(response.data)
      .toString('utf8');

    if (response.status < 200 || response.status >= 300) {
      console.error(
        `Target returned status ${response.status}:`,
        responseText
      );

      return sendUtf8(
        res,
        `id_list_message=t-שגיאה בקבלת הנתונים. קוד שגיאה ${response.status},&`
      );
    }

    return sendUtf8(res, responseText);

  } catch (error) {
    console.error('Proxy error:', error);

    const errorMessage =
      error.code === 'ECONNABORTED'
        ? 'תם הזמן לקבלת תשובה מהסקריפט'
        : error.message;

    return sendUtf8(
      res,
      `id_list_message=t-שגיאת שרת פרוקסי: ${errorMessage},&`
    );
  }
});

/**
 * בדיקה שהשרת פעיל.
 */
app.get('/health', (req, res) => {
  return sendUtf8(res, 'השרת פעיל ותומך בעברית');
});

/**
 * טיפול בכתובות שלא קיימות.
 */
app.use((req, res) => {
  return sendUtf8(
    res,
    'id_list_message=t-שגיאה: הכתובת המבוקשת אינה קיימת,&'
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dynamic Proxy server running on port ${PORT}`);
});
