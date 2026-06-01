const app = getApp<IAppOption>();

Page({
  data: {
    isLoggedIn: false,
    userInfo: null as UserInfo | null,
    reviewList: [] as ReviewRecord[],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo,
    });

    // 只加载当前用户上传的记录
    if (app.globalData.isLoggedIn && app.globalData.userInfo?._openid) {
      const db = wx.cloud.database();
      db.collection('review_records')
        .where({ _openid: app.globalData.userInfo._openid })
        .limit(5)
        .get()
        .then((res: any) => {
          // 按提交时间降序排列
          const list = (res.data || []).sort((a: any, b: any) =>
            new Date(b.submitTime).getTime() - new Date(a.submitTime).getTime()
          );
          this.setData({ reviewList: list });
        })
        .catch(() => {
          this.setData({ reviewList: [] });
        });
    }
  },

  /** 跳转登录 */
  onTapLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  /** 点击记录——跳转审核进度表 */
  onTapReview() {
    wx.navigateTo({ url: '/pages/review-table/review-table' });
  },

  /** 社联联系方式 */
  onTapContact() {
    wx.showModal({
      title: '社联联系方式',
      content: '如有疑问请咨询自己社团对应的社联干事。\n办公地点：文体中心104',
      showCancel: false,
    });
  },

  /** 退出登录 */
  onTapLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除本地缓存',
      confirmColor: '#DC2626',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          wx.showToast({ title: '已退出', icon: 'success' });
          // 重新加载页面数据
          this.onShow();
        }
      },
    });
  },

  /** 跳转上传页 */
  onTapUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },
});
