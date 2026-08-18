import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SproutIcon, UserIcon, LockIcon, ArrowRightIcon } from 'lucide-react'
export const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const success = await login(username, password)
      if (success) {
        navigate('/')
      } else {
        setError('Credenciales incorrectas')
      }
    } catch (err) {
      setError('Error al conectar. Intente de nuevo')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleGuestLogin = () => {
    loginAsGuest()
    navigate('/')
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center text-white">
            <SproutIcon className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
          Sistema de Monitoreo
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          IoT para Cultivos
        </p>
      </div>

      <div className="mt-8 mx-auto w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 sm:px-6 shadow rounded-lg md:rounded-lg transition-colors duration-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Usuario
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md py-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="•••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 p-3 rounded">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Conectando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  O continuar como
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGuestLogin}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-green-500 transition-colors group"
              >
                Entrar como Invitado
                <ArrowRightIcon className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
