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

  /** 打开/刷新飞书在线表格 */
  onTapExport() {
    wx.showLoading({ title: '同步中…' });
    wx.cloud.callFunction({
      name: 'syncToBitable',
      success: (res: any) => {
        wx.hideLoading();
        if (res.result.code === 0) {
          wx.showToast({ title: '已同步 ' + (res.result.updated || 0) + ' 个社团', icon: 'success' });
        } else {
          wx.showToast({ title: res.result.msg || '失败', icon: 'none' });
        }
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '同步失败', icon: 'none' }); },
    });
  },

  /** 长按标题清空测试数据 */
  onClearData() {
    wx.showModal({
      title: '清空测试数据',
      content: '将删除所有审核记录和存储文件，确认？',
      confirmColor: '#DC2626',
      success: (m) => {
        if (!m.confirm) return;
        wx.showLoading({ title: '清理中…' });
        wx.cloud.callFunction({
          name: 'cleanupTestData',
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已清空', icon: 'success' });
            this.loadRecords();
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '清理失败', icon: 'none' }); },
        });
      },
    });
  },

  onPullDownRefresh() {
    this.loadRecords();
    setTimeout(() => wx.stopPullDownRefresh(), 500);
  },
});
