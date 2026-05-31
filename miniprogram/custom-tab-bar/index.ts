Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/hall/hall',
        text: '首页',
      },
      {
        pagePath: '/pages/mine/mine',
        text: '我的',
      },
    ],
  },

  methods: {
    switchTab(e: WechatMiniprogram.BaseEvent) {
      const { index, path } = e.currentTarget.dataset;
      if (this.data.selected === index) return;
      // 先跳转，页面 onShow 会同步 selected
      wx.switchTab({ url: path });
    },
  },
});
