const app = getApp<IAppOption>();

Page({
  data: {
    review: null as ReviewRecord | null,
    timeline: [
      { title: '文档已上传', time: '2026年5月30日 14:30', desc: '文件：2026年社团年审表_篮球协会.docx（1.2M）', done: true },
      { title: '系统校验中', time: '2026年5月30日 14:30', desc: '检测到 2 处格式问题，已生成批注', done: true, current: true },
      { title: '初审结果', time: '等待审核反馈', desc: '', done: false, current: false },
    ],
    annotations: [
      {
        type: 'error',
        label: '错误1',
        title: '章节标题格式不匹配',
        detail: '"社团工作报告"标题未使用方正小标宋简体 二号',
        suggestion: '选中标题→字体"方正小标宋简体"→字号"二号"',
      },
      {
        type: 'warn',
        label: '错误2',
        title: '正文格式不匹配',
        detail: '正文为宋体，应为仿宋_GB2312 小四',
        suggestion: '全选正文→字体"仿宋_GB2312"→字号"小四"',
      },
    ],
  },

  onLoad(options: { id?: string }) {
    if (options.id) {
      const review = app.globalData.reviewList.find((r) => r.id === options.id);
      if (review) {
        this.setData({ review });
      }
    }
    if (!this.data.review) {
      this.setData({ review: app.globalData.currentReview });
    }
  },
});
