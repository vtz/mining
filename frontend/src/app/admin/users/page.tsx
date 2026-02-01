'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { authFetch } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UserMineInfo {
  mine_id: string;
  mine_name: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: string;
  is_admin: boolean;
  is_active: boolean;
  mine_access: UserMineInfo[];
}

interface CreateUserForm {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  is_admin: boolean;
}

interface EditUserForm {
  name: string;
  password: string;
  confirmPassword: string;
  is_admin: boolean;
  is_active: boolean;
}

interface Mine {
  id: string;
  name: string;
  region_name: string;
}

interface MineAccess {
  mine_id: string;
  role: string;
}

export default function UsersPage() {
  const t = useTranslations();
  const [users, setUsers] = useState<User[]>([]);
  const [mines, setMines] = useState<Mine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserForm>({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    is_admin: false,
  });

  // Edit state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    name: '',
    password: '',
    confirmPassword: '',
    is_admin: false,
    is_active: true,
  });
  const [editMineAccess, setEditMineAccess] = useState<MineAccess[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchMines();
  }, []);

  const fetchMines = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/mines`);
      if (response.ok) {
        const data = await response.json();
        setMines(data.mines || []);
      }
    } catch (err) {
      console.error('Error fetching mines:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: !currentStatus }),
      });
      if (!response.ok) throw new Error('Failed to update user');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    }
  };

  const toggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (!response.ok) throw new Error('Failed to update user');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Validate
    if (!form.email || !form.name || !form.password) {
      setCreateError(t('admin.users.fillRequired'));
      return;
    }

    if (form.password.length < 6) {
      setCreateError(t('admin.users.passwordMinLength'));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setCreateError(t('admin.users.passwordMismatch'));
      return;
    }

    setCreateLoading(true);

    try {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          password: form.password,
          is_admin: form.is_admin,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || t('admin.users.errorCreating'));
      }

      // Success - reset form and refresh
      setForm({ email: '', name: '', password: '', confirmPassword: '', is_admin: false });
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('admin.users.errorCreating'));
    } finally {
      setCreateLoading(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setCreateError(null);
    setForm({ email: '', name: '', password: '', confirmPassword: '', is_admin: false });
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      password: '',
      confirmPassword: '',
      is_admin: user.is_admin,
      is_active: user.is_active,
    });
    // Set current mine access
    setEditMineAccess(
      user.mine_access.map((ma) => ({
        mine_id: ma.mine_id,
        role: ma.role,
      }))
    );
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditError(null);
    setEditForm({ name: '', password: '', confirmPassword: '', is_admin: false, is_active: true });
    setEditMineAccess([]);
  };

  const toggleMineAccess = (mineId: string) => {
    setEditMineAccess((prev) => {
      const exists = prev.find((ma) => ma.mine_id === mineId);
      if (exists) {
        return prev.filter((ma) => ma.mine_id !== mineId);
      } else {
        return [...prev, { mine_id: mineId, role: 'viewer' }];
      }
    });
  };

  const updateMineRole = (mineId: string, role: string) => {
    setEditMineAccess((prev) =>
      prev.map((ma) => (ma.mine_id === mineId ? { ...ma, role } : ma))
    );
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (!editForm.name) {
      setEditError(t('admin.users.nameRequired'));
      return;
    }

    if (editForm.password && editForm.password.length < 6) {
      setEditError(t('admin.users.passwordMinLength'));
      return;
    }

    if (editForm.password && editForm.password !== editForm.confirmPassword) {
      setEditError(t('admin.users.passwordMismatch'));
      return;
    }

    setEditLoading(true);

    try {
      const updateData: Record<string, unknown> = {
        name: editForm.name,
        is_admin: editForm.is_admin,
        is_active: editForm.is_active,
      };

      if (editForm.password) {
        updateData.password = editForm.password;
      }

      // Update user info
      const response = await authFetch(`${API_BASE_URL}/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || t('admin.users.errorUpdating'));
      }

      // Update mine access
      const mineResponse = await authFetch(`${API_BASE_URL}/api/v1/users/${editingUser.id}/mines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMineAccess),
      });

      if (!mineResponse.ok) {
        console.error('Failed to update mine access');
      }

      closeEditModal();
      fetchUsers();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('admin.users.errorUpdating'));
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.users.title')}</h1>
          <p className="text-gray-600">{t('admin.users.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('admin.users.addUser')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModal}></div>
            
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateUser}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{t('admin.users.createUser')}</h3>
                    <p className="text-sm text-gray-500">{t('admin.users.createUserHint')}</p>
                  </div>

                  {createError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {createError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('auth.email')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        placeholder="user@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('auth.name')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.users.password')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        placeholder={t('admin.users.minPassword')}
                        minLength={6}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('admin.users.confirmPassword')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        placeholder={t('admin.users.repeatPassword')}
                        required
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_admin}
                        onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                        className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{t('admin.users.administrator')}</span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="w-full sm:w-auto inline-flex justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {createLoading ? t('admin.users.creating') : t('admin.users.createUser')}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeEditModal}></div>
            
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full max-h-[90vh] flex flex-col">
              <form onSubmit={handleEditUser} className="flex flex-col max-h-[90vh]">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 overflow-y-auto flex-1">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{t('admin.users.editUser')}</h3>
                    <p className="text-sm text-gray-500">{editingUser.email}</p>
                  </div>

                  {editError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {editError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('auth.name')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        required
                      />
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-500 mb-3">{t('admin.users.leaveBlankPassword')}</p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.users.newPassword')}
                          </label>
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                            placeholder={t('admin.users.minPassword')}
                            minLength={6}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin.users.confirmNewPassword')}
                          </label>
                          <input
                            type="password"
                            value={editForm.confirmPassword}
                            onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                            placeholder={t('admin.users.repeatNewPassword')}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.is_admin}
                          onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                          className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">{t('admin.users.administrator')}</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                          className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{t('admin.users.active')}</span>
                      </label>
                    </div>

                    {/* Mine Access */}
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('admin.users.mineAccess')}
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {mines.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-2">{t('admin.users.noMinesAvailable')}</p>
                        ) : (
                          mines.map((mine) => {
                            const access = editMineAccess.find((ma) => ma.mine_id === mine.id);
                            const hasAccess = !!access;
                            return (
                              <div key={mine.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={() => toggleMineAccess(mine.id)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="flex-1 text-sm text-gray-700">{mine.name}</span>
                                {hasAccess && (
                                  <select
                                    value={access?.role || 'viewer'}
                                    onChange={(e) => updateMineRole(mine.id, e.target.value)}
                                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                                  >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="w-full sm:w-auto inline-flex justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                  >
                    {editLoading ? t('common.saving') : t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.users.user')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.users.provider')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.users.mines')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.users.admin')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.users.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-8 h-8 rounded-full mr-3"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 mr-3 flex items-center justify-center text-gray-600 font-medium">
                        {user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500 capitalize">{user.auth_provider}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.mine_access.length > 0 ? (
                      user.mine_access.map((ma) => (
                        <span
                          key={ma.mine_id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {ma.mine_name} ({ma.role})
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">{t('admin.users.noMines')}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 rounded text-xs font-medium ${
                    user.is_admin
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.is_admin ? t('admin.users.adminRole') : t('admin.users.userRole')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 rounded text-xs font-medium ${
                    user.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? t('admin.users.active') : t('admin.users.inactive')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => openEditModal(user)}
                    className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                  >
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
