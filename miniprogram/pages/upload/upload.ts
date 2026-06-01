const app = getApp<IAppOption>();

Page({
  data: {
    currentStep: 1,
    clubName: '',
    file: null as { name: string; size: string; path: string; rawSize: number } | null,
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
        this.setData({ file: { name: f.name, size: this.fmt(f.size), path: f.path, rawSize: f.size }, isUploading: true });
        setTimeout(() => this.setData({ isUploading: false }), 600);
      },
    });
  },

  fmt(bytes: number) { return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB'; },

  startValidation() {
    this.setData({ currentStep: 2 });
    wx.showLoading({ title: '校验中…' });

    // 先上传到云存储，再调用云函数真实解析 docx
    wx.cloud.uploadFile({
      cloudPath: `temp-check/${Date.now()}.docx`,
      filePath: this.data.file!.path,
      success: (upRes) => {
        wx.cloud.callFunction({
          name: 'validateDocument',
          data: { fileID: upRes.fileID },
          success: (cfRes: any) => {
            wx.hideLoading();
            if (cfRes.result.code === 0) {
              this.setData({
                validationDone: true,
                validationErrors: cfRes.result.errors || [],
              });
              const count = (cfRes.result.errors || []).length;
              wx.showToast({ title: count > 0 ? '发现' + count + '处问题' : '校验合格！', icon: 'none' });
            } else {
              wx.showToast({ title: '校验失败: ' + cfRes.result.msg, icon: 'none' });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '校验服务不可用', icon: 'none' });
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '文件上传失败', icon: 'none' });
      },
    });
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
        const uploadDoc = (cb: (fileID?: string) => void) => {
          if (!hasErrors) {
            wx.cloud.uploadFile({
              cloudPath: `passed-docs/${clubName}_V${Date.now()}.docx`,
              filePath: file.path,
              success: (upRes) => cb(upRes.fileID),
              fail: () => cb(),
            });
          } else {
            cb();
          }
        };

        uploadDoc((cloudFileID) => {
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
                  passedFileID: hasErrors ? '' : (cloudFileID || ''),
                },
              }).then(() => {
                wx.hideLoading();
                const msg = hasErrors ? '已提交 V' + version + '（未通过）' : '已提交 V' + version + '（已通过）';
                wx.showToast({ title: msg, icon: 'success' });
                // 同步到飞书表格
                wx.cloud.callFunction({
                  name: 'syncToBitable',
                  success: () => console.log('飞书表格已同步'),
                  fail: (err: any) => console.error('飞书同步失败:', err),
                });
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
        });
      },
    });
  },
});
