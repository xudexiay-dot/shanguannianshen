const https = require('https');
exports.main = async () => {
  const body = JSON.stringify({ app_id: 'cli_aa97a87140785beb', app_secret: 'UboNh7lcSBv6Gp53Wic8agDFBw7wAQie' });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){resolve({});} }); });
    req.write(body); req.end();
  });
};
