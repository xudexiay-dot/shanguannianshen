const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { clubName, fileName, fileID, action } = event;
  const wxContext = cloud.getWXContext();

  // ========== 提交审核 ==========
  if (action === 'submit') {
    // 查这个社团之前交过几版
    const prev = await db.collection('review_records')
      .where({ clubName, status: 'rejected' })
      .orderBy('version', 'desc')
      .limit(1)
      .get();
    const version = prev.data.length > 0 ? prev.data[0].version + 1 : 1;

    const record = {
      clubName,
      fileName,
      fileID,
      version,
      submitTime: new Date(),
      submitterOpenid: wxContext.OPENID,
      status: 'pending',
      rejectReason: '',
      passTime: null,
      passedFileID: '',
    };

    const res = await db.collection('review_records').add({ data: record });
    return { code: 0, recordId: res._id, version };
  }

  // ========== 审核通过 ==========
  if (action === 'approve') {
    const { recordId } = event;
    // 把通过的文档复制到 review-passed 文件夹
    const srcFileID = event.fileID;
    const passTime = new Date();

    try {
      // 复制文件到 review-passed 目录
      const copyRes = await cloud.downloadFile({ fileID: srcFileID });
      const uploadRes = await cloud.uploadFile({
        cloudPath: `review-passed/${clubName}_V${event.version}_${Date.now()}.docx`,
        fileContent: copyRes.fileContent,
      });

      await db.collection('review_records').doc(recordId).update({
        data: {
          status: 'passed',
          passTime,
          passedFileID: uploadRes.fileID,
        },
      });
      return { code: 0, passedFileID: uploadRes.fileID };
    } catch (err) {
      return { code: -1, msg: '文件存档失败: ' + err.message };
    }
  }

  // ========== 驳回（reason 为详细错误数组） ==========
  if (action === 'reject') {
    const { recordId, reason, errors } = event;
    // reason 是简要概述，errors 是详细错误列表
    const rejectDetail = {
      summary: reason || '',
      errors: errors || [],  // [{title, location, detail, expected, suggestion}]
      rejectTime: new Date(),
    };
    await db.collection('review_records').doc(recordId).update({
      data: { status: 'rejected', rejectReason: rejectDetail },
    });
    return { code: 0 };
  }

  return { code: -1, msg: '未知操作' };
};
