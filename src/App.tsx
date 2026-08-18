import React from 'react';
import { AppRouter } from './AppRouter';
import { AuthProvider } from './contexts/AuthContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { EventLogProvider } from './contexts/EventLogContext';

export function App() {
  return (
    <AuthProvider>
      <DeviceProvider>
        <EventLogProvider>
          <AppRouter />
        </EventLogProvider>
      </DeviceProvider>
    </AuthProvider>
  );
}
