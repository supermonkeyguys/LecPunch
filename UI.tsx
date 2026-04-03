import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  Clock, 
  Users, 
  User, 
  Play, 
  Square, 
  AlertTriangle,
  LogOut,
  Smartphone,
  LayoutDashboard,
  History,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  Eye,
  Calendar,
  ChevronDown
} from 'lucide-react';

// --- Mock Data ---
const MOCK_WEEKS = [
  { value: 'current', label: '本周 (3.23 ~ 3.29)' },
  { value: 'prev1', label: '上周 (3.16 ~ 3.22)' },
  { value: 'prev2', label: '第3周 (3.09 ~ 3.15)' },
  { value: 'prev3', label: '第2周 (3.02 ~ 3.08)' },
];

// 为了演示，根据不同周数返回不同数据
const getTeamDataByWeek = (week) => {
  const base = [
    { id: 1, name: '张伟', avatar: 'https://i.pravatar.cc/150?u=1', isOnline: true, currentSession: '02:15:30', role: 'admin' },
    { id: 2, name: '李娜', avatar: 'https://i.pravatar.cc/150?u=2', isOnline: true, currentSession: '00:45:12', role: 'member' },
    { id: 3, name: '王强', avatar: 'https://i.pravatar.cc/150?u=3', isOnline: true, currentSession: '04:10:00', role: 'member' },
    { id: 4, name: '赵丽', avatar: 'https://i.pravatar.cc/150?u=4', isOnline: false, currentSession: '-', role: 'member' },
    { id: 5, name: '陈晨', avatar: 'https://i.pravatar.cc/150?u=5', isOnline: false, currentSession: '-', role: 'member' },
    { id: 6, name: '刘洋', avatar: 'https://i.pravatar.cc/150?u=6', isOnline: false, currentSession: '-', role: 'member' },
  ];
  // 模拟不同周的时长变化
  if (week === 'current') {
    return base.map(m => ({ ...m, weekTotal: m.id === 1 ? '24h 30m' : m.id === 6 ? '40h 20m' : '12h 45m' }));
  } else {
    return base.map(m => ({ ...m, weekTotal: m.id === 1 ? '45h 00m' : m.id === 6 ? '38h 10m' : '20h 15m', isOnline: false, currentSession: '-' }));
  }
};

const getHistoryDataByWeek = (week) => {
  if (week === 'current') {
    return [
      { id: 101, date: '3.26 (今天)', in: '08:30:00', out: '11:45:30', duration: '3h 15m 30s', status: 'valid', type: '正常' },
      { id: 102, date: '3.25 (昨天)', in: '14:00:00', out: '18:30:00', duration: '4h 30m 00s', status: 'valid', type: '正常' },
      { id: 103, date: '3.24 (周二)', in: '09:00:00', out: '-', duration: '0h 00m 00s', status: 'invalid', type: '超时作废' },
    ];
  } else {
    return [
      { id: 104, date: '3.20 (周五)', in: '19:00:00', out: '22:00:00', duration: '3h 00m 00s', status: 'valid', type: '正常' },
      { id: 105, date: '3.18 (周三)', in: '08:00:00', out: '12:00:00', duration: '4h 00m 00s', status: 'valid', type: '正常' },
      { id: 106, date: '3.16 (周一)', in: '13:00:00', out: '18:00:00', duration: '5h 00m 00s', status: 'valid', type: '正常' },
    ];
  }
}

export default function WebCheckinApp() {
  const [currentView, setCurrentView] = useState('login'); 
  const [selectedMember, setSelectedMember] = useState(null); 
  const [selectedWeek, setSelectedWeek] = useState('current'); // 新增：全局选中的周数
  
  // Check-in State
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 获取对应周数的数据
  const teamData = getTeamDataByWeek(selectedWeek);
  const historyData = getHistoryDataByWeek(selectedWeek);
  const currentUserWeekTotal = selectedWeek === 'current' ? '24h 30m' : '38h 15m'; // 模拟当前用户选中周的总时长

  useEffect(() => {
    let interval = null;
    if (isCheckedIn) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (!isCheckedIn && elapsedSeconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, elapsedSeconds]);

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setCurrentView('dashboard');
  };

  const toggleCheckIn = () => {
    if (!isCheckedIn) {
      setIsCheckedIn(true);
      setElapsedSeconds(0); 
    } else {
      setIsCheckedIn(false);
    }
  };

  // --- Components ---

  const DesktopLogin = () => (
    <div className="flex h-screen w-full bg-gray-50">
      <div className="hidden lg:flex flex-col justify-center items-center w-5/12 bg-blue-600 text-white p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pattern-grid-lg"></div>
        <div className="z-10 text-center">
          <Clock className="w-24 h-24 mx-auto mb-8 opacity-90" />
          <h1 className="text-4xl font-bold mb-4">FocusTeam 打卡系统</h1>
          <p className="text-blue-100 text-lg max-w-sm mx-auto">
            连接专属网络，记录每一次专注。专为实验室与高效团队打造。
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来 👋</h2>
            <p className="text-gray-500">请输入您的手机号验证登录</p>
          </div>
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input type="tel" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" defaultValue="13800138000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
              <div className="flex gap-3">
                <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" defaultValue="1234" />
                <button type="button" className="px-5 py-2.5 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap">获取验证码</button>
              </div>
            </div>
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors mt-4">登录系统</button>
          </form>
        </div>
      </div>
    </div>
  );

  const Sidebar = () => (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col z-20">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Clock className="w-6 h-6 text-blue-600 mr-2" />
        <span className="text-lg font-bold text-gray-900 tracking-tight">FocusTeam</span>
      </div>
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">主菜单</div>
        <button onClick={() => setCurrentView('dashboard')} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <LayoutDashboard className="w-5 h-5 mr-3" /> 工作台
        </button>
        <button onClick={() => { setCurrentView('team'); setSelectedMember(null); }} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'team' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <Users className="w-5 h-5 mr-3" /> 团队成员
        </button>
        <button onClick={() => setCurrentView('history')} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <History className="w-5 h-5 mr-3" /> 我的记录
        </button>
      </div>
      <div className="p-4 border-t border-gray-100">
        <button onClick={() => setCurrentView('login')} className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          <LogOut className="w-5 h-5 mr-3" /> 退出登录
        </button>
      </div>
    </div>
  );

  const Header = () => (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 sticky top-0">
      <div className="flex items-center text-sm">
        <div className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
          <Wifi className="w-4 h-4 mr-2" />
          <span className="font-medium">已连接团队网络: Lab-5G-Pro</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
        <button className="text-gray-400 hover:text-gray-600 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="w-px h-6 bg-gray-200 mx-2"></div>
        <div className="flex items-center cursor-pointer">
          <img src="https://i.pravatar.cc/150?u=me" alt="User Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
          <span className="ml-2 text-sm font-medium text-gray-700 hidden md:block">测试用户 (ID:8899)</span>
        </div>
      </div>
    </header>
  );

  // 公共组件：周数选择器
  const WeekSelector = () => (
    <div className="relative group">
      <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-blue-400 transition-colors cursor-pointer">
        <Calendar className="w-4 h-4 text-blue-600 mr-2" />
        <select 
          className="appearance-none bg-transparent text-sm font-bold text-gray-700 pr-6 focus:outline-none cursor-pointer"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          {MOCK_WEEKS.map(w => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" />
      </div>
    </div>
  );

  const renderDashboard = () => {
    const weeks = 20;
    const heatmapData = Array.from({ length: weeks * 7 }).map(() => Math.floor(Math.random() * 4));
    const maxSeconds = 5 * 60 * 60;
    const progressPercent = Math.min((elapsedSeconds / maxSeconds) * 100, 100);
    const isWarning = elapsedSeconds > (4.5 * 60 * 60);

    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
            <p className="text-gray-500 text-sm mt-1">
              当前显示：<span className="font-medium text-blue-600">{MOCK_WEEKS.find(w=>w.value === selectedWeek)?.label}</span> 的数据
            </p>
          </div>
          <WeekSelector />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            
            {/* Main Check-in Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
              {isCheckedIn && <div className={`absolute top-0 left-0 w-1 h-full ${isWarning ? 'bg-red-500' : 'bg-blue-500'}`}></div>}
              
              {/* Data Summary embedded in card */}
              <div className="absolute top-6 right-8 text-right hidden md:block">
                <p className="text-xs text-gray-400 mb-1 uppercase font-bold tracking-wider">该周累计打卡</p>
                <p className="text-2xl font-mono font-bold text-blue-600">{currentUserWeekTotal}</p>
              </div>

              <div className="flex-1 text-center md:text-left pt-8 md:pt-0">
                <h3 className="text-gray-500 font-medium mb-2">{isCheckedIn ? '正在记录专注时长...' : (selectedWeek === 'current' ? '当前未打卡，开始今天的努力吧！' : '查看历史周数据中')}</h3>
                <div className={`text-6xl font-mono font-bold tracking-tight mb-4 ${isCheckedIn ? 'text-gray-900' : 'text-gray-300'}`}>
                  {formatTime(elapsedSeconds)}
                </div>
                
                {isCheckedIn && (
                  <div className="max-w-md">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">单次有效时长 (上限5小时)</span>
                      <span className={isWarning ? 'text-red-600 font-bold' : 'text-blue-600 font-medium'}>
                        {Math.floor(progressPercent)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isWarning ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    {isWarning && (
                      <p className="text-sm text-red-600 mt-2 flex items-center bg-red-50 p-2 rounded-md">
                        <AlertTriangle className="w-4 h-4 mr-2" /> 
                        警告：即将超过5小时上限，请及时下卡！
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button - 仅在“本周”允许打卡 */}
              <div className="flex-shrink-0">
                {selectedWeek === 'current' ? (
                  <button 
                    onClick={toggleCheckIn}
                    className={`w-48 h-48 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                      isCheckedIn 
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200/50 animate-pulse-slow' 
                        : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-200/50 hover:shadow-blue-300/50'
                    }`}
                  >
                    {isCheckedIn ? <Square className="w-12 h-12 mb-3 fill-current" /> : <Play className="w-12 h-12 mb-3 ml-2 fill-current" />}
                    <span className="font-bold text-2xl tracking-widest">{isCheckedIn ? '下卡' : '上卡'}</span>
                  </button>
                ) : (
                  <div className="w-48 h-48 rounded-full flex flex-col items-center justify-center bg-gray-50 border-4 border-dashed border-gray-200 text-gray-400">
                    <History className="w-10 h-10 mb-2 opacity-50" />
                    <span className="font-medium text-sm text-center px-4">历史周<br/>不可打卡</span>
                  </div>
                )}
              </div>
            </div>

            {/* Heatmap Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 flex items-center"><History className="w-5 h-5 mr-2 text-gray-400" /> 近期打卡活跃度</h3>
                <div className="text-sm text-gray-500">本学期累计：<span className="font-bold text-gray-900">342</span> 小时</div>
              </div>
              
              <div className="flex">
                <div className="flex flex-col gap-2 text-xs text-gray-400 pr-3 pt-6 justify-between">
                  <span>一</span><span>三</span><span>五</span><span>日</span>
                </div>
                <div className="flex-1 overflow-x-auto pb-2">
                  <div className="flex gap-1.5 min-w-max">
                    {Array.from({ length: weeks }).map((_, weekIdx) => (
                      <div key={weekIdx} className="flex flex-col gap-1.5">
                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                          const val = heatmapData[weekIdx * 7 + dayIdx];
                          let colorClass = 'bg-gray-100'; 
                          if (val === 1) colorClass = 'bg-blue-200';
                          if (val === 2) colorClass = 'bg-blue-400';
                          if (val === 3) colorClass = 'bg-blue-600';
                          return (
                            <div 
                              key={dayIdx} 
                              className={`w-[14px] h-[14px] rounded-[3px] ${colorClass} hover:ring-2 hover:ring-gray-300 transition-all cursor-pointer`}
                              title={`打卡活跃度: ${val}`}
                            ></div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Team Online Status */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full max-h-[calc(100vh-12rem)]">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-600" /> 团队概览 ({MOCK_WEEKS.find(w=>w.value === selectedWeek)?.label.split(' ')[0]})
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {teamData.map((member, idx) => (
                  <div key={member.id} className="flex items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                    <div className="relative mr-4">
                      <img src={member.avatar} alt={member.name} className={`w-10 h-10 rounded-full border border-gray-200 object-cover ${!member.isOnline ? 'grayscale opacity-80' : ''}`} />
                      {member.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">周累计: {member.weekTotal}</div>
                    </div>
                    {member.isOnline && (
                      <div className="text-right">
                         <div className="text-xs font-mono text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md">{member.currentSession}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <button 
                  onClick={() => setCurrentView('team')}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  查看完整排行榜 &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的打卡记录</h1>
          <p className="text-gray-500 text-sm mt-1">查看您在 <span className="font-medium text-blue-600">{MOCK_WEEKS.find(w=>w.value === selectedWeek)?.label}</span> 的详细流水。</p>
        </div>
        <div className="flex items-center gap-3">
          <WeekSelector />
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm whitespace-nowrap">导出 Excel</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="p-4 pl-6">日期</th>
                <th className="p-4">上卡时间</th>
                <th className="p-4">下卡时间</th>
                <th className="p-4">本次时长</th>
                <th className="p-4">状态</th>
                <th className="p-4 pr-6 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 pl-6 text-sm font-medium text-gray-900">{row.date}</td>
                  <td className="p-4 text-sm text-gray-600 font-mono">{row.in}</td>
                  <td className="p-4 text-sm text-gray-600 font-mono">{row.out}</td>
                  <td className={`p-4 text-sm font-bold font-mono ${row.status === 'valid' ? 'text-gray-900' : 'text-red-500 line-through'}`}>
                    {row.duration}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row.status === 'valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {row.status === 'invalid' ? (
                      <button className="text-orange-600 hover:text-orange-900 text-sm font-medium">申诉补卡</button>
                    ) : (
                      <span className="text-gray-300 text-sm">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {historyData.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">该周暂无打卡记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTeam = () => {
    if (selectedMember) {
      return (
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-6 flex items-center gap-4">
            <button onClick={() => setSelectedMember(null)} className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors shadow-sm">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <img src={selectedMember.avatar} alt="avatar" className="w-8 h-8 rounded-full border border-gray-200 object-cover" />
                {selectedMember.name} 的记录
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                查看该成员在 <span className="font-medium text-blue-600">{MOCK_WEEKS.find(w=>w.value === selectedWeek)?.label}</span> 的数据。
              </p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex gap-6">
              <div className="text-sm"><span className="text-gray-500">角色：</span><span className="font-medium text-gray-900">{selectedMember.role === 'admin' ? '管理员' : '成员'}</span></div>
              <div className="text-sm"><span className="text-gray-500">选中周累计：</span><span className="font-bold text-blue-600 font-mono text-base">{selectedMember.weekTotal}</span></div>
            </div>
            {/* 列表复用 historyData 结构演示 */}
            <div className="p-8 text-center text-gray-400">详细流水（演示数据省略）</div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">团队数据</h1>
            <p className="text-gray-500 text-sm mt-1">查看团队成员在 <span className="font-medium text-blue-600">{MOCK_WEEKS.find(w=>w.value === selectedWeek)?.label}</span> 的排行与记录。</p>
          </div>
          <div className="flex items-center gap-3">
            <WeekSelector />
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜索成员..." className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">排名 / 成员信息</th>
                  <th className="p-4">角色</th>
                  <th className="p-4">当前状态</th>
                  <th className="p-4">选中周累计时长</th>
                  <th className="p-4 pr-6 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* 根据选中周的时长进行降序排序 (简单模拟) */}
                {[...teamData].sort((a,b) => parseInt(b.weekTotal) - parseInt(a.weekTotal)).map((member, idx) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 pl-6 flex items-center gap-4">
                      <div className={`w-6 text-center font-bold ${idx < 3 ? 'text-blue-600' : 'text-gray-400'}`}>{idx + 1}</div>
                      <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full border border-gray-200 object-cover" />
                      <div>
                        <div className="text-sm font-bold text-gray-900">{member.name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {member.role === 'admin' ? '管理员' : '普通成员'}
                      </span>
                    </td>
                    <td className="p-4">
                      {member.isOnline ? (
                        <div className="flex items-center text-sm text-green-600 font-medium">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                          在线 ({member.currentSession})
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-gray-400">离线</div>
                      )}
                    </td>
                    <td className="p-4 text-base font-mono font-bold text-gray-800">
                      {member.weekTotal}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button 
                        onClick={() => setSelectedMember(member)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye className="w-4 h-4 mr-1" /> 查流水
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {currentView === 'login' ? (
        <DesktopLogin />
      ) : (
        <div className="flex h-full w-full">
          <Sidebar />
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto">
              {currentView === 'dashboard' && renderDashboard()}
              {currentView === 'history' && renderHistory()}
              {currentView === 'team' && renderTeam()}
            </main>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 25px 15px rgba(244, 63, 94, 0.15); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .pattern-grid-lg {
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px);
        }
      `}} />
    </div>
  );
}