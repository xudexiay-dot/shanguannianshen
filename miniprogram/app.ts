interface UserInfo {
  _id?: string;
  _openid?: string;
  avatar?: string;
  nickName: string;    // 用户昵称/姓名
  role: string;         // '社团负责人' | '社联干事'
  orgName: string;      // 所属社团
  deptName: string;     // 归口盖章单位
}

interface ReviewRecord {
  id: string;
  fileName: string;
  uploadDate: string;
  status: string;      // '校验中' | '已通过' | '待修改' | '审核中'
  reviewer?: string;
  reviewDate?: string;
  fileSize: string;
  errors?: Array<{ title: string; detail: string; suggestion: string }>;
}

interface IAppOption {
  globalData: {
    userInfo: UserInfo | null;
    isLoggedIn: boolean;
    reviewList: ReviewRecord[];
    currentReview: ReviewRecord | null;
  };
}

App<IAppOption>({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    reviewList: [],
    currentReview: null,
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-d7g4t7fhqf3566d2f' });
    }

    // 检查本地缓存的登录状态
    const cachedUser = wx.getStorageSync('userInfo');
    if (cachedUser) {
      this.globalData.userInfo = cachedUser;
      this.globalData.isLoggedIn = true;
    }

  },
});
