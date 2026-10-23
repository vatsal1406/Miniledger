import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider } from '@/context/AuthContext';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen after initialization
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <AppTabs />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
