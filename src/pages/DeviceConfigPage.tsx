import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { updateDeviceName, deleteDevice, Device } from '../services/firebase';
import {
  SettingsIcon,
  CpuIcon,
  PencilIcon,
  Trash2Icon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
} from 'lucide-react';

export const DeviceConfigPage: React.FC = () => {
  const { availableDevices, reloadDevices } = useDevice();
  const { isAdmin } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleDeviceAdded = async (newDevice: Device) => {
    setShowAddModal(false)
    setSuccess(`Dispositivo "${newDevice.name}" agregado correctamente`)
    await reloadDevices()
    setTimeout(() => setSuccess(''), 3000)
  }

  const startEdit = (device: Device) => {
    setEditingId(device.id);
    setNewName(device.name);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!editingId || !newName.trim()) {
      setError('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const ok = await updateDeviceName(editingId, newName);
      if (ok) {
        setSuccess('Nombre actualizado correctamente');
        await reloadDevices();
        setEditingId(null);
        setNewName('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error al actualizar el nombre');
      }
    } catch (err) {
      setError('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (device: Device) => {
    setDeviceToDelete(device);
  };

  const confirmDelete = async () => {
    if (!deviceToDelete) return;

    setDeletingId(deviceToDelete.id);
    setError('');
    setSuccess('');

    try {
      const ok = await deleteDevice(deviceToDelete.id);
      if (ok) {
        setSuccess('Dispositivo eliminado correctamente');
        await reloadDevices();
        if (editingId === deviceToDelete.id) cancelEdit();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error al eliminar el dispositivo');
      }
    } catch (err) {
      setError('Error inesperado');
    } finally {
      setDeletingId(null);
      setDeviceToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeviceToDelete(null);
  };

  return (
    <Layout>
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center min-w-0">
            <SettingsIcon className="h-6 sm:h-8 w-6 sm:w-8 text-gray-600 mr-2 sm:mr-3 flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
              Configuración de Dispositivos
            </h1>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-green-600 text-white font-medium text-xs sm:text-sm hover:bg-green-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Agregar dispositivo</span>
              <span className="sm:hidden">Agregar</span>
            </button>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
          Administra los nombres y ajustes de tus dispositivos de monitoreo
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 sm:px-6 py-2 sm:py-3">
          <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">Dispositivos</span>
        </div>

        {/* Content Section */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {availableDevices.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-3 sm:p-4 inline-block mb-4">
                <CpuIcon className="h-6 sm:h-8 w-6 sm:w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                No hay dispositivos registrados aún
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableDevices.map((device) => (
                <div
                  key={device.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-600 transition-all hover:border-gray-200 dark:hover:border-gray-500"
                >
                  <div className="flex items-start gap-2 sm:gap-4">
                    {/* Device Icon */}
                    <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                      <CpuIcon className="h-5 sm:h-6 w-5 sm:w-6 text-green-600 dark:text-green-400" />
                    </div>

                    {/* Device Info */}
                    <div className="flex-1 min-w-0">
                      {editingId === device.id ? (
                        <div className="space-y-2 sm:space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Nuevo nombre del dispositivo
                            </label>
                            <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              placeholder="Ingresa el nuevo nombre"
                              autoFocus
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
                            />
                          </div>
                          <div className="flex gap-2 flex-col sm:flex-row">
                            <button
                              onClick={handleSave}
                              disabled={saving || !newName.trim()}
                              className="flex-1 px-3 py-2 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium rounded-lg transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full overflow-hidden">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {device.name}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            ID: {device.id}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Edit Button */}
                    {editingId !== device.id && (
                      <div className="flex gap-1 sm:gap-2 items-center flex-shrink-0 flex-col sm:flex-row">
                        <button
                          onClick={() => startEdit(device)}
                          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                          onClick={() => handleDelete(device)}
                          disabled={deletingId === device.id}
                          className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{deletingId === device.id ? 'Eliminando...' : 'Eliminar'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <AddDeviceModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onDeviceAdded={handleDeviceAdded}
        />
      )}

      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Eliminar dispositivo</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                ¿Eliminar dispositivo "{deviceToDelete.name}" (ID: {deviceToDelete.id})? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId === deviceToDelete.id}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingId === deviceToDelete.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <XCircleIcon className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
          <CheckCircleIcon className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{success}</span>
        </div>
      )}
    </Layout>
  );
};