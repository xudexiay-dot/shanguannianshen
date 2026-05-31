Page({
  data: {
    records: [] as any[],
    passedCount: 0,
    pendingCount: 0,
    loading: true,
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    this.setData({ loading: true });
    const db = wx.cloud.database();
    db.collection('review_records')
      .get()
      .then((res: any) => {
        const records = (res.data || []).sort((a: any, b: any) =>
          a.clubName.localeCompare(b.clubName, 'zh') || b.version - a.version
        );
        const passedCount = records.filter((r: any) => r.status === 'passed').length;
        const pendingCount = records.filter((r: any) => r.status !== 'passed').length;
        this.setData({ records, loading: false, passedCount, pendingCount });
      })
      .catch(() => {
        this.setData({ records: [], passedCount: 0, pendingCount: 0, loading: false });
      });
  },

  /** 导出Excel——上传到云存储再下载 */
  onTapExport() {
    if (this.data.records.length === 0) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成中…' });

    let csv = '﻿社团,版本,提交时间,状态,驳回原因,通过时间\n';
    this.data.records.forEach((r: any) => {
      const reason = r.rejectReason
        ? (typeof r.rejectReason === 'string' ? r.rejectReason : (r.rejectReason.summary || '')).replace(/,/g, '，')
        : '';
      const passTime = r.passTime ? r.passTime : '';
      const statusText = r.status === 'passed' ? '已通过' : r.status === 'rejected' ? '未通过' : '待审核';
      csv += `${r.clubName},V${r.version},${r.submitTime},${statusText},"${reason}",${passTime}\n`;
    });

    // 上传 CSV 到云存储
    const cloudPath = `exports/年审进度表_${Date.now()}.csv`;
    wx.cloud.uploadFile({
      cloudPath,
      fileContent: csv,
      success: (res) => {
        wx.hideLoading();
        // 获取临时下载链接并打开
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success: (tmpRes) => {
            if (tmpRes.fileList[0].tempFileURL) {
              wx.showModal({
                title: '导出成功',
                content: 'CSV 文件已生成，可用 Excel / WPS 打开。',
                confirmText: '打开文件',
                success: (m) => {
                  if (m.confirm) {
                    wx.downloadFile({
                      url: tmpRes.fileList[0].tempFileURL,
                      success: (dl) => {
                        wx.openDocument({ filePath: dl.tempFilePath, showMenu: true });
                      },
                    });
                  }
                },
              });
            }
          },
          fail: () => {
            wx.showModal({ title: '导出成功', content: '文件已保存到云存储 exports/ 目录', showCancel: false });
          },
        });
      },
      fail: (err: any) => {
        wx.hideLoading();
        wx.showToast({ title: '导出失败: ' + (err.errMsg || ''), icon: 'none' });
      },
    });
  },

  onPullDownRefresh() {
    this.loadRecords();
    setTimeout(() => wx.stopPullDownRefresh(), 500);
  },
});
