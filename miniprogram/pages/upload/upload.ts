const app = getApp<IAppOption>();

Page({
  data: {
    currentStep: 1,
    clubName: '',
    file: null as { name: string; size: string; path: string } | null,
    isUploading: false,
    validationDone: false,
    validationErrors: [] as any[],
  },

  onChooseFile() {
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['doc', 'docx'],
      success: (res) => {
        const f = res.tempFiles[0];
        if (f.size > 5 * 1024 * 1024) { wx.showToast({ title: '文件不能超过5M', icon: 'none' }); return; }
        this.setData({ file: { name: f.name, size: this.fmt(f.size), path: f.path }, isUploading: true });
        setTimeout(() => this.setData({ isUploading: false }), 600);
      },
    });
  },

  fmt(bytes: number) { return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB'; },

  startValidation() {
    this.setData({ currentStep: 2 });
    wx.showLoading({ title: '校验中…' });
    setTimeout(() => {
      wx.hideLoading();
      const errors = [
        { type: 'error', title: '章节标题字体错误', location: '第2页「社团工作报告」标题行', detail: '标题当前为黑体三号', expected: '方正小标宋简体 二号', suggestion: '在 Word 中选中标题文字 → 字体下拉选"方正小标宋简体" → 字号选"二号" → 确认替换' },
        { type: 'error', title: '正文字体不对', location: '第2页正文第1段', detail: '正文当前为宋体', expected: '仿宋_GB2312 小四', suggestion: 'Ctrl+A 全选正文 → 字体下拉找到"仿宋_GB2312" → 字号选"小四" → 确认' },
        { type: 'warn', title: '成员名单未分页', location: '第3页「社员名单」前', detail: '名单紧接在工作报告后面', expected: '成员名单从新页开始', suggestion: '光标放在「社员名单」标题前 → 按 Ctrl+Enter 插入分页符' },
        { type: 'warn', title: '签名处已填写', location: '第2页底部「负责人签字」栏', detail: '电子版中负责人签名栏有文字', expected: '签名栏留空', suggestion: '把负责人签名删掉 → 日期也删掉 → 审查通过后打印纸质版手写' },
      ];
      this.setData({ validationDone: true, validationErrors: errors });
    }, 2000);
  },

  onTapReupload() {
    this.setData({ file: null, currentStep: 1, validationDone: false, validationErrors: [] });
  },

  onClubNameInput(e: WechatMiniprogram.Input) { this.setData({ clubName: e.detail.value }); },

  /** 确认提交——有错误=未通过，无错误=已通过 */
  onTapSubmit() {
    if (!app.globalData.userInfo) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }

    const clubName = this.data.clubName.trim();
    if (!clubName) { wx.showToast({ title: '请先输入社团名称', icon: 'none' }); return; }

    const hasErrors = this.data.validationDone && this.data.validationErrors.length > 0;

    wx.showModal({
      title: '确认提交 — ' + clubName,
      content: hasErrors
        ? '当前有 ' + this.data.validationErrors.length + ' 处校验错误，提交后状态为【未通过】。\n\n确定提交吗？'
        : '校验合格，提交后状态为【已通过】。\n提交后不可修改，确认提交？',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '提交中…' });

        const db = wx.cloud.database();
        const file = this.data.file!;

        // 如果是通过状态，先上传文档到 passed-docs 云端文件夹存档
        const uploadDoc = (cb: () => void) => {
          if (!hasErrors) {
            wx.cloud.uploadFile({
              cloudPath: `passed-docs/${clubName}_V${Date.now()}.docx`,
              filePath: file.path,
              success: () => cb(),
              fail: () => cb(), // 存档失败不阻塞提交
            });
          } else {
            cb();
          }
        };

        uploadDoc(() => {
          db.collection('review_records')
            .where({ clubName })
            .orderBy('version', 'desc').limit(1).get()
            .then((prev: any) => {
              const version = prev.data.length > 0 ? prev.data[0].version + 1 : 1;

              const rejectReason = hasErrors ? {
                summary: this.data.validationErrors.map((e: any) => e.title).join('、'),
                errors: this.data.validationErrors,
              } : null;

              return db.collection('review_records').add({
                data: {
                  clubName,
                  fileName: file.name,
                  version,
                  submitTime: new Date(),
                  status: hasErrors ? 'rejected' : 'passed',
                  rejectReason,
                  passTime: hasErrors ? null : new Date(),
                },
              }).then(() => {
                wx.hideLoading();
                const msg = hasErrors ? '已提交 V' + version + '（未通过）' : '已提交 V' + version + '（已通过）';
                wx.showToast({ title: msg, icon: 'success' });
                setTimeout(() => wx.switchTab({ url: '/pages/hall/hall' }), 1500);
            });
          })
          .catch((err: any) => {
            wx.hideLoading();
            if (err.errCode === -502005) {
              wx.showModal({ title: '数据库未配置', content: '请在云开发控制台 → 数据库 → 新建集合「review_records」，权限选「仅创建者可读写」', showCancel: false });
            } else {
              wx.showToast({ title: '提交失败，请重试', icon: 'none' });
            }
          });
      },
    });
  },
});
