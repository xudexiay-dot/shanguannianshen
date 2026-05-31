const app = getApp<IAppOption>();

Page({
  onTapWechatLogin() {
    wx.showLoading({ title: '登录中…' });
    wx.login({
      success: () => {
        wx.cloud.callFunction({
          name: 'userLogin',
          success: (res: any) => {
            wx.hideLoading();
            if (res.result.code === 0) {
              app.globalData.userInfo = res.result.user;
              app.globalData.isLoggedIn = true;
              wx.setStorageSync('userInfo', res.result.user);
              wx.showToast({ title: '登录成功', icon: 'success' });
              setTimeout(() => wx.switchTab({ url: '/pages/hall/hall' }), 800);
            } else {
              wx.showToast({ title: '登录失败', icon: 'none' });
            }
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '请确认云函数已部署', icon: 'none' }); },
        });
      },
    });
  },

  onTapBack() { wx.switchTab({ url: '/pages/hall/hall' }); },
});
