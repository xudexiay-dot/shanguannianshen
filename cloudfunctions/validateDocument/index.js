const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const zlib = require('zlib');

const VALID_FONTS = ['仿宋_GB2312', '仿宋', '方正小标宋简体', '楷体_GB2312', '楷体', '新宋体', '黑体', 'zh', '', 'Times New Roman'];

function extractDocXml(buf) {
  let off = 0;
  while (off < buf.length - 4) {
    if (buf.readUInt32LE(off) !== 0x04034b50) { off++; continue; }
    const nl = buf.readUInt16LE(off + 26), el = buf.readUInt16LE(off + 28);
    const cs = buf.readUInt32LE(off + 18), cm = buf.readUInt16LE(off + 8);
    const ns = off + 30, nm = buf.slice(ns, ns + nl).toString();
    const ds = ns + nl + el;
    if (nm === 'word/document.xml')
      return cm === 8 ? zlib.inflateRawSync(buf.slice(ds, ds + cs)).toString() : buf.slice(ds, ds + cs).toString();
    off = ds + cs;
  }
  return null;
}

/** 提取所有段落的纯文本列表 */
function extractParagraphs(xml) {
  const result = [];
  const pr = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pm;
  while ((pm = pr.exec(xml)) !== null) {
    const texts = [];
    const tr = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tr.exec(pm[0])) !== null) texts.push(tm[1]);
    result.push(texts.join(''));
  }
  return result;
}

exports.main = async (event) => {
  const { fileID } = event;
  if (!fileID) return { code: -1, msg: '缺少文件' };

  const dlRes = await cloud.downloadFile({ fileID });
  if (!dlRes.fileContent) return { code: -1, msg: '下载失败' };

  const xml = extractDocXml(dlRes.fileContent);
  if (!xml) return { code: -1, msg: '解析失败' };

  const errors = [];
  const paragraphs = extractParagraphs(xml);

  // 找到「社团工作报告」的位置——之后才是需要校验的区域
  let reportStart = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    if (/社团工作|社\s*团\s*工\s*作/.test(paragraphs[i])) {
      reportStart = i;
      break;
    }
  }

  // 报告区之后的所有文本（用于检测签名、日期等）
  const afterReportText = paragraphs.slice(reportStart).join('\n');
  const afterReportClean = afterReportText.replace(/\s+/g, '');

  // ===== 1. 字体检测 =====
  const badFonts = new Set();
  const fm = xml.matchAll(/w:eastAsia="([^"]+)"/g);
  for (const m of fm) {
    const f = m[1];
    if (!VALID_FONTS.includes(f) && !f.startsWith('Times')) badFonts.add(f);
  }
  if (badFonts.size > 0) {
    errors.push({
      type: 'error', title: '包含非标准字体',
      location: '正文', detail: '检测到非标准字体：' + [...badFonts].join('、'),
      expected: '正文统一使用仿宋_GB2312',
      suggestion: 'Ctrl+A 全选正文 → 字体下拉选"仿宋_GB2312" → 若没有此字体先安装字体包',
    });
  }

  // ===== 2. 成员名单分页 =====
  const memberIdx = xml.search(/员\s*名\s*单/);
  if (memberIdx > 0) {
    const before = xml.substring(Math.max(0, memberIdx - 2000), memberIdx);
    if (!/w:type="page"|w:pageBreakBefore|<w:lastRenderedPageBreak|<w:sectPr/.test(before)) {
      errors.push({
        type: 'warn', title: '成员名单未单独分页',
        location: '成员名单前', detail: '未检测到分页符',
        expected: '成员名单从新页开始',
        suggestion: '光标放在成员名单标题前 → Ctrl+Enter 插入分页符',
      });
    }
  }

  // ===== 3. 签名检测（逐段检测，仅限报告区之后） =====
  for (let i = reportStart; i < paragraphs.length; i++) {
    const p = paragraphs[i].replace(/\s+/g, '');
    const signMatch = p.match(/(?:负责人|签字)\s*[：:]\s*([^\s，。,.\d]{2,4})$/);
    if (signMatch && signMatch[1].length >= 2 &&
      !/一栏只填|小四|GB2312|字体|字号|说明|填写|手写|钢笔/.test(p)) {
      errors.push({
        type: 'error', title: '签名/负责人栏已填写',
        location: '社团工作报告区签字栏',
        detail: '检测到填写内容：' + signMatch[1],
        expected: '电子版签名栏留空',
        suggestion: '删除签字栏的姓名 → 审查通过后打印纸质版手写签名',
      });
      break;
    }
  }

  // ===== 4. 日期检测（仅限报告区之后） =====
  // 匹配 2026年1月1日 或 2026  年 1 月 1  日 等形式
  const dateMatch = afterReportClean.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) {
    errors.push({
      type: 'error', title: '日期已填写',
      location: '报告区日期栏',
      detail: '检测到日期：' + dateMatch[0],
      expected: '电子版日期留空',
      suggestion: '删除年、月、日前的数字 → 审查通过后打印纸质版手写日期',
    });
  }

  // ===== 5. 报告区正文字号检测 =====
  const reportXml = xml.substring(xml.indexOf('社团工作报告') > 0 ? xml.indexOf('社团工作报告') - 500 : 0);
  const szRegex = /<w:sz w:val="(\d+)"/g;
  const badSizes = new Set();
  let szM;
  while ((szM = szRegex.exec(reportXml)) !== null) {
    const sz = parseInt(szM[1]);
    if (![18, 21, 24, 28, 32, 36, 44, 72].includes(sz)) {
      badSizes.add((sz / 2) + 'pt');
    }
  }
  if (badSizes.size > 0) {
    errors.push({
      type: 'warn', title: '部分字号不标准',
      location: '正文', detail: '检测到非标准字号：' + [...badSizes].join('、'),
      expected: '正文小四，表格小四，意见栏四号',
      suggestion: '检查字号：正文→小四，意见栏→四号，标题→二号',
    });
  }

  // ===== 6. 意见栏填写了内容 =====
  const sectionHeaders = ['社团工作', '员名单', '主要成果', '获奖情况', '指导老师意见',
    '管理部门审查', '校团委意见', '社团管理部门', '指 导 教 师'];
  for (const label of ['指导老师意见', '管理部门审查意见', '校团委意见']) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].replace(/\s+/g, '');
      if (p.includes(label.replace(/\s+/g, ''))) {
        for (let j = i + 1; j < Math.min(i + 3, paragraphs.length); j++) {
          const next = paragraphs[j].replace(/\s+/g, '');
          // 遇到下一个章节标题就停
          if (sectionHeaders.some(h => next.includes(h))) break;
          // 纯日期行或公章行跳过
          if (/公章|年月日|^[\d\s\.\-\/年月日]*$/.test(next)) continue;
          // 空行跳过
          if (next.length <= 3) continue;
          // 有实际内容
          if (next.length > 5) {
            errors.push({
              type: 'warn', title: '意见栏可能已填写',
              location: label,
              detail: '检测到内容：' + next.substring(0, 20),
              expected: '意见栏留空',
              suggestion: '意见栏留空 → 审查通过后纸质版填写，第一个意见可写"同意"',
            });
            break;
          }
        }
        break;
      }
    }
  }

  // ===== 8. 封面信息完整性 =====
  const coverText = paragraphs.slice(0, reportStart).join('\n').replace(/\s+/g, '');
  // 社团名称后应填写
  if (!/社团名称\s*[：:]\s*\S{2,}/.test(coverText)) {
    errors.push({ type: 'error', title: '封面社团名称未填写', location: '封面', detail: '社团名称为空', expected: '填写社团全称', suggestion: '在封面"社团名称"处填写社团全称' });
  }
  // 负责人后应填写
  if (!/负\s*责\s*人\s*[：:]\s*\S{2,}/.test(coverText)) {
    errors.push({ type: 'error', title: '封面负责人未填写', location: '封面', detail: '负责人为空', expected: '填写负责人姓名', suggestion: '在封面"负责人"处填写姓名' });
  }
  // 填表日期应填写
  if (!/填表日期\s*[：:]\s*\d{4}/.test(coverText)) {
    errors.push({ type: 'error', title: '封面填表日期未填写', location: '封面', detail: '填表日期为空', expected: '填写日期如2026.6.1', suggestion: '在封面"填表日期"处填写日期' });
  }

  // ===== 9. 主要成果/获奖情况应有内容 =====
  for (const field of ['主要成果', '获奖情况']) {
    const idx = paragraphs.findIndex(p => p.replace(/\s+/g, '').includes(field));
    if (idx > 0) {
      let hasContent = false;
      for (let j = idx + 1; j < Math.min(idx + 5, paragraphs.length); j++) {
        const text = paragraphs[j].replace(/\s+/g, '');
        if (text.length > 5 && !/小四|GB2312|字体|字号|指导老师|校团委/.test(text)) {
          hasContent = true; break;
        }
      }
      if (!hasContent) {
        errors.push({ type: 'warn', title: field + '未填写', location: '报告正文', detail: field + '栏为空', expected: '填写' + field + '内容', suggestion: '在' + field + '区域填写实际内容' });
      }
    }
  }

  // ===== 10. 缺少必要章节 =====
  const requiredSections = ['社团工作', '员名单', '指导老师意见', '校团委意见'];
  for (const sec of requiredSections) {
    if (!paragraphs.some(p => p.replace(/\s+/g, '').includes(sec.replace(/\s+/g, '')))) {
      errors.push({
        type: 'error', title: '缺少必要章节',
        location: '全文',
        detail: '未找到"' + sec + '"章节',
        expected: '年审报告必须包含' + sec + '章节',
        suggestion: '请使用标准模板，确保所有章节完整',
      });
    }
  }

  // ===== 9. 公章处填写姓名检测 =====
  // 在原始段落中找"公章"后面的实际内容（不合并空格）
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (/公章/.test(p)) {
      // 取"公章"后面的内容
      const afterSeal = p.replace(/.*公章\s*[：:]?\s*/, '');
      const clean = afterSeal.replace(/\s+/g, '');
      // 排除模板标签（年月日、部门名）
      const isTemplate = /^(年|月|日|[\s]*)*$/.test(clean) || /校团委|管理部门|审查意见|指导/.test(clean) || clean.length <= 1;
      if (clean && !isTemplate) {
        errors.push({
          type: 'error', title: '公章栏已填写',
          location: '意见栏公章处',
          detail: '公章后检测到内容：' + clean,
          expected: '公章栏留空',
          suggestion: '删除公章后的文字 → 盖章在纸质版上完成',
        });
        break;
      }
    }
  }

  // ===== 6. 意见栏填写了日期之外的文字 =====
  // 例如在"指导老师意见"后面写了实际意见内容
  const opinionSections = afterReportText.match(/指导老师意见|管理部门审查|校\s*团\s*委\s*意\s*见/g);
  if (opinionSections) {
    // 检查意见栏标题后的段落是否有实际意见内容（排除日期和公章）
    for (const label of ['指导老师意见', '管理部门审查', '校团委意见']) {
      const idx = afterReportClean.indexOf(label);
      if (idx > 0) {
        const after = afterReportClean.substring(idx + label.length, idx + label.length + 100);
        // 如果有「同意」或较长的文字内容（排除公章、日期）
        const opinion = after.replace(/公章|年|月|日|[：:\s]/g, '');
        if (opinion.length > 5) {
          // 只有意见内容比较长才报
        }
      }
    }
  }

  return { code: 0, errors };
};
