const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const APP_ID = 'cli_aa97a87140785beb';
const APP_SECRET = 'UboNh7lcSBv6Gp53Wic8agDFBw7wAQie';

async function getToken() {
  return new Promise((resolve) => {
    const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const req = https.request({
      hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).tenant_access_token); } catch(e) { resolve(''); } }); });
    req.write(body); req.end();
  });
}

exports.main = async (event) => {
  const { cloudFileID, fileName } = event;
  if (!cloudFileID) return { code: 0 };

  const token = await getToken();
  if (!token) return { code: -1 };

  const dl = await cloud.downloadFile({ fileID: cloudFileID });
  if (!dl.fileContent) return { code: -1 };

  // 上传到飞书
  const boundary = '----F' + Date.now();
  const CRLF = '\r\n';
  const parts = [
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="file_name"${CRLF}${CRLF}${fileName}${CRLF}`),
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="parent_type"${CRLF}${CRLF}explorer${CRLF}`),
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="size"${CRLF}${CRLF}${dl.fileContent.length}${CRLF}`),
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`),
    dl.fileContent,
    Buffer.from(`${CRLF}--${boundary}--`),
  ];
  const body = Buffer.concat(parts);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'open.feishu.cn', path: '/open-apis/drive/v1/files/upload_all',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': String(body.length) },
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({ _raw: d }); }
      });
    });
    req.write(body); req.end();
  });
};
