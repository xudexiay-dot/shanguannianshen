const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  // 清空审核记录
  const records = await db.collection('review_records').get();
  let deleted = 0;
  for (const r of records.data) {
    await db.collection('review_records').doc(r._id).remove();
    deleted++;
    // 如果有云存储文件，顺便删掉
    if (r.passedFileID) {
      try { await cloud.deleteFile({ fileList: [r.passedFileID] }); } catch (e) {}
    }
  }

  // 清空飞书配置表格token
  try {
    const config = await db.collection('feishu_config').where({ key: 'spreadsheet_token' }).get();
    for (const c of config.data) {
      await db.collection('feishu_config').doc(c._id).remove();
    }
  } catch (e) {}

  return { code: 0, deleted_records: deleted };
};
