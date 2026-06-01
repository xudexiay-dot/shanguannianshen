const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');
const db = cloud.database();

const APP_ID = 'cli_aa97a87140785beb';
const APP_SECRET = 'UboNh7lcSBv6Gp53Wic8agDFBw7wAQie';
const BASE_ID = 'DexvbhvJYaloIzsAymOcMLSznae';
const TABLE_ID = 'tbl1Mho7hPQlQjfD';

function request(url, method, token, body) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': bodyStr.length },
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ _raw: d }); } }); });
    req.on('error', (e) => resolve({ code: -1, msg: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getToken() {
  const res = await request('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', 'POST', '', { app_id: APP_ID, app_secret: APP_SECRET });
  return res.tenant_access_token || '';
}

const fmtTime = d => { if (!d) return ''; const t = new Date(d); t.setHours(t.getHours()+8); const p = n => String(n).padStart(2, '0'); return `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()} ${p(t.getHours())}:${p(t.getMinutes())}`; };

/** 确保必要字段存在 */
async function ensureFields(token) {
  const existing = await request(`https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TABLE_ID}/fields`, 'GET', token);
  const names = (existing.data?.items || []).map(f => f.field_name);

  const needed = ['年审版本', '提交时间', '状态', '驳回原因', '通过时间', '文档位置'];
  for (const name of needed) {
    if (!names.includes(name)) {
      await request(`https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TABLE_ID}/fields`, 'POST', token, { field_name: name, type: 1 });
      console.log('添加字段:', name);
    }
  }
}

exports.main = async () => {
  const token = await getToken();
  if (!token) return { code: -1, msg: '认证失败' };

  // 确保字段存在
  await ensureFields(token);

  // 读所有审核记录
  const reviewRes = await db.collection('review_records').get();
  const reviews = (reviewRes.data || []).sort((a, b) => (a.clubName||'').localeCompare(b.clubName||'', 'zh') || b.version - a.version);

  // 一次性拉取全部记录，本地匹配
  const allRecords = [];
  let pageToken = '';
  do {
    const res = await request(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TABLE_ID}/records?page_size=100&page_token=${pageToken}`,
      'GET', token
    );
    const items = res.data?.items || [];
    allRecords.push(...items);
    pageToken = res.data?.has_more ? res.data?.page_token : '';
  } while (pageToken);

  let updated = 0;
  const updatedClubs = new Set();

  for (const r of reviews) {
    if (updatedClubs.has(r.clubName)) continue;

    // 模糊匹配：提取核心关键词
    const core = r.clubName.replace(/[社团协会队部中心站室厅处局院系班]$/g, '').replace(/^[山管SDMU]/g, '');
    const match = allRecords.find(item => {
      const name = item.fields['社团名称'] || '';
      const nameCore = name.replace(/[社团协会队部中心站室厅处局院系班]$/g, '').replace(/^[山管SDMU]/g, '');
      return name.includes(r.clubName) || r.clubName.includes(name) || nameCore.includes(core) || core.includes(nameCore);
    });

    console.log(`"${r.clubName}"(核:${core}) → ${match ? '匹配:' + match.fields['社团名称'] : '未找到'}`);

    if (match) {
      // 更新已有记录：把年审信息写入「描述」列
      const status = r.status === 'passed' ? '已通过' : r.status === 'rejected' ? '未通过' : '';
      const docLoc = r.passedFileID ? 'passed-docs/' + r.passedFileID.split('/').pop() : '';
      const reason = r.rejectReason ? (typeof r.rejectReason === 'string' ? r.rejectReason : (r.rejectReason.summary || '')) : '';
      const desc = `【年审 V${r.version}】提交: ${fmtTime(r.submitTime)} | 状态: ${status} | ${r.passTime ? '通过: ' + fmtTime(r.passTime) : ''}${reason ? '驳回: ' + reason : ''} | ${docLoc}`;

      await request(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_ID}/tables/${TABLE_ID}/records/${match.record_id}`,
        'PUT', token,
        { fields: { '描述': desc } }
      );
      updatedClubs.add(r.clubName);
      updated++;
    }
  }

  return { code: 0, updated, totalReviews: reviews.length };
};
