const app = getApp<IAppOption>();

Page({
  data: {
    year: '2026',
    dateStart: '6月3日',
    dateEnd: '6月10日',
    isLoggedIn: false,
    userInfo: null as UserInfo | null,
  },

  onShow() {
    // 同步 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // 同步登录状态
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo,
    });
  },

  /** 模板下载 */
  onTapTemplate() {
    wx.showModal({
      title: '获取年审模板',
      content: '请联系自己社团对应的社联干事获取 2026 年审报告模板.docx。\n\n使用须知：\n• 电子版签名、日期一律留空\n• 正文：仿宋_GB2312 小四\n• 章节标题：方正小标宋简体 二号\n• 成员名单单独分页\n• 指导老师意见栏留空待手签',
      showCancel: false,
    });
  },

  /** 文档上传 — 未登录跳转登录页 */
  onTapUpload() {
    if (!this.data.isLoggedIn) {
      this.showLoginRequired();
      return;
    }
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  /** 审核进度表 */
  onTapReviewTable() {
    if (!this.data.isLoggedIn) {
      this.showLoginRequired();
      return;
    }
    wx.navigateTo({ url: '/pages/review-table/review-table' });
  },

  /** 常见问题 */
  onTapFaq() {
    wx.navigateTo({ url: '/pages/faq/faq' });
  },

  /** 联系方式 */
  onTapContact() {
    wx.showModal({
      title: '社联联系方式',
      content: '如有疑问请咨询自己社团对应的社联干事。\n办公地点：文体中心104',
      showCancel: false,
    });
  },

  /** 归口盖章单位 */
  onTapDeptList() {
    wx.showModal({
      title: '盖章说明',
      content: '请根据指导老师所属单位盖章。指导老师若为体育教学部，则盖体育教学部章。',
      showCancel: false,
    });
  },

  /** 未登录弹窗 */
  showLoginRequired() {
    wx.showModal({
      title: '请先登录',
      content: '查看此内容需要登录账号',
      confirmText: '去登录',
      success(res) {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/login/login' });
        }
      },
    });
  },
});
