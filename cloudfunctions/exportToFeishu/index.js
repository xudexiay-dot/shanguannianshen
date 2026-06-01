const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const FEISHU_APP_ID = 'cli_aa97a87140785beb';
const FEISHU_APP_SECRET = 'UboNh7lcSBv6Gp53Wic8agDFBw7wAQie'; // 换Secret后改这里

const db = cloud.database();
const https = require('https');

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opt = { hostname: u.hostname, path: u.pathname, method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...options.headers } };
    const req = https.request(opt, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ _raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getToken() {
  const data = await request('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', { method: 'POST' }, { app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET });
  return data.tenant_access_token;
}

/** 从数据库读所有记录并排序 */
async function loadRecords() {
  const records = (await db.collection('review_records').get()).data;
  return records.sort((a, b) => (a.clubName || '').localeCompare(b.clubName || '', 'zh') || b.version - a.version);
}

/** 格式化时间为北京时间 */
function fmtTime(d) {
  if (!d) return '';
  const t = new Date(d);
  // 转北京时间 UTC+8
  t.setHours(t.getHours() + 8);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日 ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

/** 构建表格行数据 */
/** 从 fileID 提取永久下载链接 */
async function buildRows(records) {
  return [
    ['社团', '版本', '提交时间', '状态', '驳回原因', '通过时间', '文档位置'],
    ...records.map(r => {
      const reason = r.rejectReason ? (typeof r.rejectReason === 'string' ? r.rejectReason : (r.rejectReason.summary || '')) : '';
      const status = r.status === 'passed' ? '已通过' : r.status === 'rejected' ? '未通过' : '';
      // 优先显示飞书文档链接，其次云存储路径
      const location = r.feishuDocUrl || (
        r.passedFileID
          ? r.passedFileID.replace('cloud://cloud1-d7g4t7fhqf3566d2f.636c-cloud1-d7g4t7fhqf3566d2f-1438465389/', '')
          : r.status === 'passed' ? '已通过（未存档）' : ''
      );
      return [r.clubName, 'V' + r.version, fmtTime(r.submitTime), status, reason, fmtTime(r.passTime), location];
    }),
  ];
}

exports.main = async () => {
  const records = await loadRecords();
  const rows = await buildRows(records);
  const colCount = 7;

  const token = await getToken();
  if (!token) return { code: -1, msg: '飞书认证失败' };

  // ===== 获取或创建持久表格 =====
  const configRes = await db.collection('feishu_config').where({ key: 'spreadsheet_token' }).get();
  let sheetToken = configRes.data.length > 0 ? configRes.data[0].value : '';

  if (!sheetToken) {
    // 首次：创建新表格，保存 token
    const createResp = await request(
      'https://open.feishu.cn/open-apis/sheets/v3/spreadsheets',
      { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } },
      { title: '社团年审进度表（自动同步）' }
    );
    if (createResp.code !== 0) return { code: -1, msg: '创建表格失败: ' + (createResp.msg || '') };
    sheetToken = createResp.data.spreadsheet.spreadsheet_token;
    await db.collection('feishu_config').add({ data: { key: 'spreadsheet_token', value: sheetToken } });
  }

  // ===== 获取 sheet_id =====
  const metaResp = await request(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/metainfo`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );
  const firstSheet = metaResp.data && metaResp.data.sheets && metaResp.data.sheets[0];
  const sheetId = firstSheet ? (firstSheet.sheetId || firstSheet.sheet_id || '') : '';
  if (!sheetId) return { code: -1, msg: '获取sheetId失败' };

  // ===== 先清空旧数据（写入空值覆盖） =====
  // 获取当前行数
  const currentRowCount = firstSheet.rowCount || 50;
  // 用空值覆盖所有旧数据
  const emptyRows = Array(currentRowCount).fill(0).map(() => Array(colCount).fill(''));
  await request(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values`,
    { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } },
    { valueRange: { range: `${sheetId}!A1:G${currentRowCount}`, values: emptyRows } }
  );

  // ===== 写入最新数据 =====
  const writeResp = await request(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${sheetToken}/values`,
    { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } },
    { valueRange: { range: `${sheetId}!A1:G${rows.length}`, values: rows } }
  );

  if (writeResp.code === 0) {
    const url = `https://bytedance.feishu.cn/sheets/${sheetToken}`;
    return { code: 0, url, recordCount: records.length };
  }
  return { code: -1, msg: '写入失败: ' + (writeResp.msg || '') };
};
