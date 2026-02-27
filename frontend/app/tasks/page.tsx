'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Plus, Edit2, Trash2, Check } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  assigned_to: number;
  assigned_to_name?: string;
  related_type: string;
  related_id: number;
  completed: boolean;
  created_at: string;
}

const TASK_STATUSES = [
  { id: 'todo', name: 'To Do', dot: '#9CA3AF' },
  { id: 'in_progress', name: 'In Progress', dot: '#3B82F6' },
  { id: 'review', name: 'Review', dot: '#8B5CF6' },
  { id: 'done', name: 'Done', dot: '#10B981' },
];

const priorityColors: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#FEF2F2', text: '#DC2626' },
  medium: { bg: '#FFFBEB', text: '#92400E' },
  low:    { bg: '#F9FAFB', text: '#6B7280' },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showModal, setShowModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task> | null>(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [agents, setAgents] = useState<{id: number; name: string; role: string}[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchTasks();
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAgents((data.data?.rows || data.users || []).filter((u: any) => u.active !== 0));
      }
    } catch (e) { console.error(e); }
  };

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setTasks(data.data || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentTask.id ? 'PUT' : 'POST';
      const url = currentTask.id ? `/api/tasks/${currentTask.id}` : '/api/tasks';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentTask),
      });
      if (res.ok) { setShowModal(false); setCurrentTask(null); fetchTasks(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchTasks();
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !task.completed, status: !task.completed ? 'done' : task.status }),
      });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const filteredTasks = filterPriority === 'all' ? tasks : tasks.filter(t => t.priority === filterPriority);
  const getTasksByStatus = (status: string) => filteredTasks.filter(t => t.status === status);
  const getStatusDot = (status: string) => TASK_STATUSES.find(s => s.id === status)?.dot || '#9CA3AF';

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Tasks</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{tasks.length} total tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F3F4F6' }}>
              <button onClick={() => setViewMode('board')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{ background: viewMode === 'board' ? 'white' : 'transparent', color: '#374151', boxShadow: viewMode === 'board' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Board</button>
              <button onClick={() => setViewMode('list')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{ background: viewMode === 'list' ? 'white' : 'transparent', color: '#374151', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>List</button>
            </div>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 text-xs border rounded-lg focus:outline-none"
              style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={() => { setCurrentTask({ status: 'todo', priority: 'medium', completed: false }); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : viewMode === 'board' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {TASK_STATUSES.map((status) => {
              const statusTasks = getTasksByStatus(status.id);
              return (
                <div key={status.id}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: status.dot }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#374151' }}>{status.name}</span>
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{statusTasks.length}</span>
                  </div>
                  <div className="space-y-3">
                    {statusTasks.map((task) => {
                      const pc = priorityColors[task.priority] || { bg: '#F9FAFB', text: '#6B7280' };
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
                      return (
                        <div key={task.id} className="bg-white rounded-xl border p-4 cursor-pointer transition-all"
                          style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${status.dot}` }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                          onClick={() => { setCurrentTask(task); setShowModal(true); }}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <button
                              className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all"
                              style={{
                                background: task.completed ? 'linear-gradient(135deg, #C9A96E, #8A6F2F)' : 'white',
                                borderColor: task.completed ? '#C9A96E' : '#D1D5DB',
                              }}
                              onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                            >
                              {task.completed && <Check className="w-2.5 h-2.5 text-white" />}
                            </button>
                            <p className="text-sm font-medium flex-1" style={{ color: task.completed ? '#9CA3AF' : '#131B2B', textDecoration: task.completed ? 'line-through' : 'none' }}>
                              {task.title}
                            </p>
                          </div>
                          {task.description && (
                            <p className="text-xs mb-2 ml-6 line-clamp-2" style={{ color: '#6B7280' }}>{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 ml-6 flex-wrap">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
                            {task.due_date && (
                              <span className="text-xs" style={{ color: isOverdue ? '#DC2626' : '#9CA3AF' }}>
                                {isOverdue ? '⚠️ ' : '📅 '}{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                            {task.assigned_to_name && (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F' }}>
                                👤 {task.assigned_to_name}
                              </span>
                            )}
                          </div>
                          {status.id !== 'done' && (
                            <div className="mt-3 ml-6">
                              <select
                                value={task.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                className="w-full px-2 py-1 text-xs border rounded-lg focus:outline-none"
                                style={{ borderColor: '#E5E7EB', color: '#374151', background: '#F9FAFB' }}
                              >
                                {TASK_STATUSES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {statusTasks.length === 0 && (
                      <div className="border-2 border-dashed rounded-xl py-8 text-center" style={{ borderColor: '#E5E7EB' }}>
                        <p className="text-xs" style={{ color: '#D1D5DB' }}>No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['', 'Task', 'Priority', 'Status', 'Assigned To', 'Due Date', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task, i) => {
                    const pc = priorityColors[task.priority] || { bg: '#F9FAFB', text: '#6B7280' };
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
                    return (
                      <tr key={task.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-5 py-3.5">
                          <button
                            className="w-5 h-5 rounded flex items-center justify-center border transition-all"
                            style={{ background: task.completed ? 'linear-gradient(135deg, #C9A96E, #8A6F2F)' : 'white', borderColor: task.completed ? '#C9A96E' : '#D1D5DB' }}
                            onClick={() => handleToggleComplete(task)}
                          >
                            {task.completed && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold" style={{ color: task.completed ? '#9CA3AF' : '#131B2B', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</p>
                          {task.description && <p className="text-xs truncate mt-0.5 max-w-[250px]" style={{ color: '#9CA3AF' }}>{task.description}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: pc.bg, color: pc.text }}>{task.priority}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: getStatusDot(task.status) }} />
                            <span className="text-sm" style={{ color: '#374151' }}>{TASK_STATUSES.find(s => s.id === task.status)?.name || task.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {task.assigned_to_name ? (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit" style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F' }}>
                              👤 {task.assigned_to_name}
                            </span>
                          ) : <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm" style={{ color: isOverdue ? '#DC2626' : '#6B7280' }}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setCurrentTask(task); setShowModal(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => handleDelete(task.id)}
                              className="px-2.5 py-1.5 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                              <Trash2 className="w-3 h-3" style={{ color: '#DC2626' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTasks.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No tasks found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && currentTask && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{currentTask.id ? 'Edit Task' : 'New Task'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Task Title *</label>
                  <input type="text" required value={currentTask.title || ''}
                    onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="Task title..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea value={currentTask.description || ''} onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                    className={inputCls} style={inputStyle} rows={2} placeholder="Task description..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Priority', key: 'priority', opts: ['low','medium','high'] },
                    { label: 'Status', key: 'status', opts: TASK_STATUSES.map(s => s.id) },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                      <select value={(currentTask as any)[f.key] || ''} onChange={(e) => setCurrentTask({ ...currentTask, [f.key]: e.target.value })}
                        className={inputCls} style={inputStyle}
                        onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}>
                        {f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Due Date</label>
                    <input type="date" value={currentTask.due_date || ''}
                      onChange={(e) => setCurrentTask({ ...currentTask, due_date: e.target.value })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Assign To</label>
                    <select
                      value={(currentTask as any).assigned_to || ''}
                      onChange={(e) => setCurrentTask({ ...currentTask, assigned_to: e.target.value ? parseInt(e.target.value) : undefined } as any)}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {currentTask.id ? 'Update Task' : 'Create Task'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentTask(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}
