Page({
  data: {
    activeTab: 0,
    tabs: ['全部', '格式问题', '分页问题', '盖章问题', '私章申请'],
    expandedIndex: 0, // 默认展开第一个
    faqList: [
      {
        category: '格式问题',
        q: '年审表正文用什么字体和字号？',
        a: '正文统一使用仿宋_GB2312 小四。章节标题使用方正小标宋简体 二号。如电脑未安装对应字体，请在模板下载页获取字体包。',
      },
      {
        category: '格式问题',
        q: '上传后显示字体校验失败怎么办？',
        a: '请按照批注中的建议修改：全选正文内容→设置字体为"仿宋_GB2312"→设置字号为"小四"。修改后重新上传即可。',
      },
      {
        category: '分页问题',
        q: '成员名单如何单独分页？',
        a: '在成员名单内容前插入分页符：将光标放在名单标题前→按Ctrl+Enter（或菜单栏"插入→分页"）。确保名单从新的一页开始。',
      },
      {
        category: '盖章问题',
        q: '我的社团应该找哪个部门盖章？',
        a: '请根据指导老师所属单位盖章。指导老师若为体育教学部，则盖体育教学部章。如有疑问联系社联确认。',
      },
      {
        category: '盖章问题',
        q: '为什么我的年审表没有盖章？',
        a: '年审为电子版审核流程，电子文档本身不含印章。审核通过后，携带纸质版根据指导老师所属单位盖章。',
      },
      {
        category: '私章申请',
        q: '社团可以自己刻章吗？',
        a: '不可以！社团不具有法人资格，任何私自刻制的公章或制作的电子印章均无法律效力。请根据指导老师所属单位正规盖章，不可私刻。',
      },
      {
        category: '私章申请',
        q: '使用电子印章（PS贴图）可以吗？',
        a: '不可以！任何形式的自制印章（含PS贴图、电子印章图片）均属私章范畴，系统校验将直接提示违规，年审不予通过。',
      },
    ],
  },

  /** 切换分类标签 */
  onTapTab(e: WechatMiniprogram.BaseEvent) {
    const { index } = e.currentTarget.dataset;
    this.setData({ activeTab: index });
  },

  /** 展开/折叠 FAQ */
  onTapFaq(e: WechatMiniprogram.BaseEvent) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      expandedIndex: this.data.expandedIndex === index ? -1 : index,
    });
  },

  /** 联系客服 */
  onTapContact() {
    wx.showModal({
      title: '联系社联客服',
      content: '办公地点：学生活动中心 201\n工作时间：工作日 14:00-17:00\n电话：0531-xxxxxxx',
      showCancel: false,
    });
  },

  /** 过滤后的 FAQ 列表 */
  get filteredFaqList() {
    const { activeTab, tabs, faqList } = this.data;
    if (activeTab === 0) return faqList;
    return faqList.filter((item) => item.category === tabs[activeTab]);
  },
});
