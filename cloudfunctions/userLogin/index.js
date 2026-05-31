const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const users = db.collection('users');

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: -1, msg: '获取 openid 失败' };

  // 查已有用户
  const res = await users.where({ _openid: openid }).get();
  if (res.data.length > 0) {
    return { code: 0, user: res.data[0] };
  }

  // 新用户自动注册
  const newUser = {
    _openid: openid,
    nickName: '社联用户',
    role: '社联干事',
    orgName: '',
    deptName: '',
    createTime: db.serverDate(),
  };
  const addRes = await users.add({ data: newUser });
  return { code: 0, user: { _id: addRes._id, ...newUser } };
};
