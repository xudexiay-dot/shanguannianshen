const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const APP_ID = 'cli_aa97a87140785beb';
const APP_SECRET = 'UboNh7lcSBv6Gp53Wic8agDFBw7wAQie';

async function getToken() {
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d).tenant_access_token);}catch(e){resolve('');} }); });
    req.write(body); req.end();
  });
}

exports.main = async (event) => {
  const { cloudFileID, fileName } = event;
  if (!cloudFileID) return { code: -1, msg: '缺少文件' };

  // 获取临时下载链接
  const tmpRes = await cloud.getTempFileURL({ fileList: [cloudFileID] });
  const tempUrl = tmpRes.fileList[0]?.tempFileURL;
  if (!tempUrl) return { code: -1, msg: '获取下载链接失败' };

  const token = await getToken();
  if (!token) return { code: -1, msg: '飞书认证失败' };

  // 调用飞书导入API
  const body = JSON.stringify({
    file: { url: tempUrl, name: fileName, type: 'docx' },
    parent: { parent_type: 'explorer' },
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'open.feishu.cn', path: '/open-apis/drive/v1/imports',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try {
          const r = JSON.parse(d);
          if (r.code === 0) resolve({ code: 0, url: r.data?.url || '', ticket: r.data?.ticket || '' });
          else resolve({ code: -1, msg: r.msg, detail: d.substring(0,200) });
        } catch(e) { resolve({ code: -1, msg: d.substring(0,200) }); }
      });
    });
    req.write(body); req.end();
  });
};
